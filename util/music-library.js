// The songs the music player can play, split into stations.
//
// With SPACES_KEY and SPACES_SECRET set, songs live on the CDN under
// music/<station>/ in the lospec bucket, so they survive redeploys and are
// streamed from there. Without them, songs are read from ./_music/<station>/
// instead, which is enough for working on the bot locally.
//
// Each song is identified by the md5 of its file. Spaces reports that as the
// ETag of anything uploaded in a single part, so duplicates can be found
// without downloading anything.
//
// How loud each song is gets measured once and kept in levels.json beside the
// stations, so the player can level them without re-encoding the files. Songs
// without a measurement (put there by hand, or from before levels existed) are
// measured in the background after the library loads.

import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { toMp3, measure, isSupported, extensionOf } from './music-audio.js';
import { withLock } from './lock.js';

export const STATIONS = {
	chill: 'Chill',
	upbeat: 'Upbeat',
};

const SPACES_ENDPOINT = 'https://nyc3.digitaloceanspaces.com';
const SPACES_BUCKET = 'lospec';
const SPACES_PREFIX = 'music/';
const LEVELS_FILE = 'levels.json';
const CDN_URL = 'https://cdn.lospec.com/';
const LOCAL_FOLDER = '_music';

export const MAX_SONG_BYTES = 50 * 1024 * 1024;

const useSpaces = Boolean(process.env.SPACES_KEY && process.env.SPACES_SECRET);
const s3 = useSpaces ? new S3Client({
	endpoint: SPACES_ENDPOINT,
	region: 'us-east-1',
	credentials: {accessKeyId: process.env.SPACES_KEY, secretAccessKey: process.env.SPACES_SECRET},
}) : null;

// station -> [{id, name, station, source}]
const library = Object.fromEntries(Object.keys(STATIONS).map(station => [station, []]));
// song id -> {loudness, peak}
let levels = {};
let loading = null;
let loaded = false;
const listeners = [];

export function loadLibrary () {
	if (!loading) loading = refreshLibrary()
		.then(() => loaded = true)
		.then(() => console.log('Music library loaded from', useSpaces ? 'spaces' : LOCAL_FOLDER + ':',
			Object.entries(library).map(([station, songs]) => station + ' ' + songs.length).join(', ')))
		.catch(err => {
			console.error('Failed to load music library:', err);
			loading = null;
		});
	return loading;
}

// Calls back with {added, removed} whenever songs come or go, whether through
// the bot or by somebody changing the files directly
export function onLibraryChange (callback) {
	listeners.push(callback);
}

// Re-reads the stations every so often, to pick up songs added or removed
// some other way than through the bot - the upload script, or by hand
export function watchLibrary (interval) {
	setInterval(() => refreshLibrary().catch(err => console.error('Failed to refresh music library:', err.message)), interval);
}

let refreshing = null;
function refreshLibrary () {
	refreshing ||= readLibrary().finally(() => refreshing = null);
	return refreshing;
}

async function readLibrary () {
	const read = useSpaces ? await readFromSpaces() : readFromFolder();
	levels = {...levels, ...read.levels};

	const added = [], removed = [];
	for (const station of Object.keys(STATIONS)) {
		const before = new Set(library[station].map(songKey));
		const after = new Set(read.songs[station].map(songKey));
		added.push(...read.songs[station].filter(song => !before.has(songKey(song))));
		removed.push(...library[station].filter(song => !after.has(songKey(song))));
		library[station] = read.songs[station];
	}
	if (loaded && (added.length || removed.length))
		console.log('Music library changed:', added.length, 'added,', removed.length, 'removed');
	notify(added, removed);
	measureMissingLevels();
}

// A renamed or replaced file counts as one song removed and another added
function songKey (song) {
	return song.id + '/' + song.name;
}

function notify (added, removed) {
	if (!added.length && !removed.length) return;
	for (const callback of listeners) {
		try { callback({added, removed}); }
		catch (err) { console.error('music library listener failed:', err); }
	}
}

async function readFromSpaces () {
	const songs = {};
	for (const station of Object.keys(STATIONS)) {
		songs[station] = [];
		let ContinuationToken;
		do {
			const page = await s3.send(new ListObjectsV2Command({
				Bucket: SPACES_BUCKET,
				Prefix: SPACES_PREFIX + station + '/',
				ContinuationToken,
			}));
			for (const object of page.Contents || []) {
				const name = object.Key.slice((SPACES_PREFIX + station + '/').length);
				if (!isSongName(name)) continue;
				songs[station].push(spacesSong(station, name, object.ETag.replace(/"/g, '')));
			}
			ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
		} while (ContinuationToken);
		songs[station].sort(byName);
	}
	return {songs, levels: await readLevels()};
}

function readFromFolder () {
	const songs = {};
	for (const station of Object.keys(STATIONS)) {
		const folder = path.join(LOCAL_FOLDER, station);
		fs.mkdirSync(folder, {recursive: true});
		songs[station] = fs.readdirSync(folder)
			.filter(isSongName)
			.map(name => {
				const file = path.join(folder, name);
				return {id: md5(fs.readFileSync(file)), name, station, source: path.resolve(file)};
			})
			.sort(byName);
	}
	return {songs, levels: readLevelsFromFolder()};
}

async function readLevels () {
	if (!useSpaces) return readLevelsFromFolder();
	try {
		const file = await s3.send(new GetObjectCommand({Bucket: SPACES_BUCKET, Key: SPACES_PREFIX + LEVELS_FILE}));
		return JSON.parse(await file.Body.transformToString());
	}
	catch (err) {
		if (err.name !== 'NoSuchKey') console.error('Failed to load music levels:', err.message);
		return {};
	}
}

function readLevelsFromFolder () {
	try { return JSON.parse(fs.readFileSync(path.join(LOCAL_FOLDER, LEVELS_FILE), 'utf8')); }
	catch (err) { return {}; }
}

function spacesSong (station, name, id) {
	return {id, name, station, source: CDN_URL + SPACES_PREFIX + station + '/' + encodeURIComponent(name)};
}

export function listSongs (station) {
	if (station) return library[station] || [];
	return Object.values(library).flat();
}

export function findSong (id) {
	return listSongs().find(song => song.id === id);
}

// Song names as somebody might type them, for autocomplete and for anything
// typed without picking a suggestion
export function searchSongs (text) {
	const terms = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
	return listSongs().filter(song => terms.every(term => song.name.toLowerCase().includes(term)));
}

// How loud a song is, if it has been measured
export function levelOf (song) {
	return levels[song.id] || null;
}

// The song's whole file
export async function readSong (song) {
	if (!/^https?:/.test(song.source)) return fs.promises.readFile(song.source);
	const response = await fetch(song.source);
	if (!response.ok) throw new Error('the cdn returned ' + response.status);
	return Buffer.from(await response.arrayBuffer());
}

// Measures a song that has not been measured yet, from its file
export async function measureSong (song, buffer) {
	if (levels[song.id]) return levels[song.id];
	const level = await measure(buffer || await readSong(song));
	await saveLevel(song.id, level);
	return level;
}

// Adds a song to a station, converting it to an mp3 first if it is something
// else. Throws, with a message fit to show the uploader, if the file can't be
// used, is already in the library, or its name is taken.
export async function addSong (station, fileName, original) {
	await loadLibrary();
	if (!STATIONS[station]) throw new Error('There is no station called "' + station + '".');
	if (original.length > MAX_SONG_BYTES) throw new Error('Songs can be at most ' + (MAX_SONG_BYTES / 1024 / 1024) + 'MB.');

	const cleanName = cleanSongName(fileName);
	if (!isSupported(cleanName)) throw new Error(code(cleanName) + ' is not a supported file. Songs can be audio files or tracker modules.');
	if (extensionOf(cleanName) === 'mp3' && !looksLikeMp3(original)) throw new Error(code(cleanName) + ' is not an mp3 file.');

	const {name, buffer} = await toMp3(cleanName, original);

	const id = md5(buffer);
	const existing = findSong(id);
	if (existing) throw new Error('This song is already on the ' + STATIONS[existing.station] + ' station as ' + code(existing.name) + '.');
	if (library[station].some(song => song.name.toLowerCase() === name.toLowerCase()))
		throw new Error('The ' + STATIONS[station] + ' station already has a song called ' + code(name) + '.');

	const level = await measure(buffer);

	let song;
	if (useSpaces) {
		await s3.send(new PutObjectCommand({
			Bucket: SPACES_BUCKET,
			Key: SPACES_PREFIX + station + '/' + name,
			Body: buffer,
			ACL: 'public-read',
			ContentType: 'audio/mpeg',
		}));
		song = spacesSong(station, name, id);
	}
	else {
		const file = path.join(LOCAL_FOLDER, station, name);
		fs.mkdirSync(path.dirname(file), {recursive: true});
		fs.writeFileSync(file, buffer);
		song = {id, name, station, source: path.resolve(file)};
	}

	library[station].push(song);
	library[station].sort(byName);
	await saveLevel(id, level);
	notify([song], []);
	return song;
}

// Removes a song from its station for good
export async function removeSong (song) {
	await loadLibrary();
	if (useSpaces) await s3.send(new DeleteObjectCommand({Bucket: SPACES_BUCKET, Key: SPACES_PREFIX + song.station + '/' + song.name}));
	else await fs.promises.rm(song.source, {force: true});

	library[song.station] = library[song.station].filter(other => other.id !== song.id);
	await saveLevel(song.id, null);
	notify([], [song]);
}

function saveLevel (id, level) {
	return withLock('music-levels', async () => {
		//merged with what is saved, so measurements written by something else
		//since this last read them aren't lost
		levels = {...await readLevels(), ...levels};
		if (level) levels[id] = level;
		else delete levels[id];

		const body = JSON.stringify(levels, null, '\t');
		if (useSpaces) await s3.send(new PutObjectCommand({
			Bucket: SPACES_BUCKET,
			Key: SPACES_PREFIX + LEVELS_FILE,
			Body: body,
			ContentType: 'application/json',
		}));
		else {
			fs.mkdirSync(LOCAL_FOLDER, {recursive: true});
			fs.writeFileSync(path.join(LOCAL_FOLDER, LEVELS_FILE), body);
		}
	});
}

// One at a time, so it never competes with playback for long
let measuring = false;
const unmeasurable = new Set();
async function measureMissingLevels () {
	if (measuring) return;
	measuring = true;
	let measured = 0;
	try {
		let missing;
		while ((missing = listSongs().filter(song => !levels[song.id] && !unmeasurable.has(song.id))).length) {
			console.log('Measuring the loudness of', missing.length, 'songs...');
			for (const song of missing) {
				try {
					await measureSong(song);
					measured++;
				}
				catch (err) {
					console.error('could not measure', song.name + ':', err.message);
					unmeasurable.add(song.id);
				}
			}
		}
		if (measured) console.log('Finished measuring song loudness');
	}
	finally { measuring = false; }
}

// A file name as inline code, for discord messages
export function code (name) {
	return '`' + String(name).replace(/`/g, "'") + '`';
}

function cleanSongName (fileName) {
	return path.basename(String(fileName))
		.replace(/[\x00-\x1f\\/:*?"<>|]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function isSongName (name) {
	return /\.mp3$/i.test(name) && name.length > 4;
}

// An ID3 tag, or the 11 set bits that start an mpeg audio frame
function looksLikeMp3 (buffer) {
	if (buffer.length < 4) return false;
	if (buffer.toString('latin1', 0, 3) === 'ID3') return true;
	return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
}

function md5 (buffer) {
	return crypto.createHash('md5').update(buffer).digest('hex');
}

function byName (a, b) {
	return a.name.localeCompare(b.name, undefined, {sensitivity: 'base'});
}

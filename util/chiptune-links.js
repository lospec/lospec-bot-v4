// Turning chiptune.app and gifx.co links into song files.
//
// chiptune.app's player streams from gifx.co/music/<path>, and a share link
// (chiptune.app/?play=<id>&subtune=<n>) names the song by an id: the first 8
// characters of base64url(sha256(file)). Only chiptune.app's own catalog maps
// ids to paths, and the bot never asks chiptune.app (it bans clients that send
// it bursts of requests), so ids are looked up in an index of hashed
// collections kept privately on Spaces under music/chiptune-ids/*.tsv
// ("id <TAB> path [<TAB> other possible path...]"), put there by
// scripts/upload-chiptune-ids.js. Files are only ever downloaded from gifx.co,
// and checked against the id.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { readStored, listStored } from './music-storage.js';

const GIFX = 'https://gifx.co/music/';
const INDEX = path.resolve('_bin', 'chiptune-ids');
const INDEX_REFRESH = 6 * 3600 * 1000;
// formats where one file holds a game's whole soundtrack
const WHOLE_SOUNDTRACK = ['nsf', 'nsfe', 'gbs', 'hes', 'kss', 'ay', 'sap'];

// {id, track} for a chiptune.app link, {path, track} for a gifx.co one, or null.
// `track` counts from 0, as chiptune.app's subtune does (missing means the first)
export function parseLink (text) {
	let url;
	try { url = new URL(String(text).trim()); }
	catch { return null; }
	const track = Math.max(0, parseInt(url.searchParams.get('subtune'), 10) || 0);
	if (/(^|\.)chiptune\.app$/.test(url.hostname)) {
		const id = url.searchParams.get('play');
		if (/^[A-Za-z0-9_-]{8}$/.test(id || '')) return {id, track};
		if (id) return {path: id.replace(/^\/+/, ''), track};  // ?play= can also be a catalog path
		const browse = url.pathname.match(/^\/browse\/(.+)$/);
		if (browse) return {path: decodeURIComponent(browse[1]), track};
		return null;
	}
	if (/(^|\.)gifx\.co$/.test(url.hostname) && url.pathname.startsWith('/music/'))
		return {path: decodeURIComponent(url.pathname.slice('/music/'.length)), track};
	return null;
}

export function songId (buffer) {
	return crypto.createHash('sha256').update(buffer).digest('base64url').slice(0, 8);
}

// Downloads a parsed link's song, and any .gsflib/.usflib/.pdx it loads, into
// `folder`. Returns {file, path, track}. Throws with a message fit for discord.
export async function downloadLink (link, folder) {
	const paths = link.path ? [link.path] : await lookUp(link.id);
	if (!paths.length) throw new Error('That chiptune.app song isn\'t in the bot\'s index yet. Use its gifx.co link instead: open the game or artist folder in chiptune.app, and add the file name to the folder\'s path.');
	for (const candidate of paths) {
		const data = await fetchFile(candidate);
		if (!data || (link.id && songId(data) !== link.id)) continue;
		const file = path.join(folder, path.posix.basename(candidate));
		fs.writeFileSync(file, data);
		for (const sidecar of sidecarsOf(file, data)) {
			const lib = await fetchFile(path.posix.join(path.posix.dirname(candidate), sidecar))
				|| await fetchFile(path.posix.join(path.posix.dirname(candidate), sidecar.toUpperCase()));
			if (!lib) throw new Error('Could not download ' + sidecar + ', which this song needs, from gifx.co.');
			fs.writeFileSync(path.join(folder, path.posix.basename(sidecar)), lib);
		}
		return {file, path: candidate, track: link.track};
	}
	throw new Error(link.id ? 'The file for that chiptune.app link could not be downloaded from gifx.co.' : 'Could not download ' + link.path + ' from gifx.co.');
}

// A song name for a catalog path, before slugging: the track's title and the
// game, or the artist and title for collections arranged by artist
export function nameFor (catalogPath, track = 0) {
	const parts = catalogPath.split('/');
	const stem = parts.at(-1).replace(/\.[^.]+$/, '');
	const folder = parts.length > 2 ? parts.at(-2) : '';
	const clean = text => text.replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/_/g, ' ').trim();
	const title = clean(stem).replace(/^\d+[a-z]?(\s*[-.]\s*|\s+)/i, '');
	if (parts[0] === 'High Voltage SID Collection') return folder + ' ' + title;
	// one file holding a whole soundtrack (nsf, gbs...) is named after the game, so the track goes in the name
	if (WHOLE_SOUNDTRACK.includes(path.posix.extname(catalogPath).slice(1).toLowerCase()) || !title) return clean(stem) + ' track ' + (track + 1);
	// folders like "- Homebrew -" group files rather than naming a game
	if (!folder || /^-.*-$/.test(folder.trim())) return title;
	return title + ' ' + clean(folder);
}

async function fetchFile (catalogPath) {
	const response = await fetch(GIFX + catalogPath.split('/').map(encodeURIComponent).join('/'));
	if (!response.ok) return null;
	return Buffer.from(await response.arrayBuffer());
}

// The library files a minigsf/miniusf (its _lib tags) or an mdx (its pdx) loads
function sidecarsOf (file, data) {
	const ext = path.extname(file).slice(1).toLowerCase();
	if (data.toString('latin1', 0, 3) === 'PSF') {
		const tagsAt = 16 + data.readUInt32LE(4) + data.readUInt32LE(8);
		const tags = data.toString('latin1', tagsAt);
		if (!tags.startsWith('[TAG]')) return [];
		// the first tag follows [TAG] on the same line
		return [...tags.slice(5).matchAll(/^_lib\d*=(.+)$/gm)].map(match => match[1].trim()).filter(Boolean);
	}
	if (ext === 'mdx') {
		const end = data.indexOf(Buffer.from([0x0d, 0x0a, 0x1a]));
		if (end < 0) return [];
		const name = data.toString('latin1', end + 3, data.indexOf(0, end + 3)).trim();
		if (!name) return [];
		return [/\.pdx$/i.test(name) ? name : name + '.PDX'];
	}
	return [];
}

// The possible catalog paths for an id, from the index
async function lookUp (id) {
	await refreshIndex();
	if (!fs.existsSync(INDEX)) return [];
	for (const name of fs.readdirSync(INDEX).filter(n => n.endsWith('.tsv')).sort()) {
		const text = fs.readFileSync(path.join(INDEX, name), 'utf8');
		let at = text.startsWith(id + '\t') ? 0 : text.indexOf('\n' + id + '\t');
		if (at < 0) continue;
		if (at > 0) at += 1;
		const end = text.indexOf('\n', at);
		return text.slice(at, end < 0 ? text.length : end).trim().split('\t').slice(1);
	}
	return [];
}

let refreshing = null, refreshed = 0;
function refreshIndex () {
	if (Date.now() - refreshed < INDEX_REFRESH) return Promise.resolve();
	refreshing ||= (async () => {
		fs.mkdirSync(INDEX, {recursive: true});
		for (const {name, modified} of await listStored('chiptune-ids/')) {
			const local = path.join(INDEX, path.basename(name));
			if (fs.existsSync(local) && fs.statSync(local).mtimeMs >= new Date(modified).getTime()) continue;
			const data = await readStored(name);
			if (data) fs.writeFileSync(local, data);
		}
		refreshed = Date.now();
	})().catch(err => console.error('Could not refresh the chiptune.app index:', err.message)).finally(() => refreshing = null);
	return refreshing;
}

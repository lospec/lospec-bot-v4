// Rendering game-music files - nsf, spc, vgm, sid, gsf, usf, mdx, midi and the
// rest - to mp3, with chip2mp3 (github.com/skeddles/chip2mp3), which runs the
// same emulators and player logic as chiptune.app compiled natively.
//
// Song length: a song plays its intro and loop once, then fades out over 8
// seconds. Songs whose intro and one loop are under a minute repeat the loop,
// up to 3 times, as long as that stays within 2:30. The loop comes from the
// VGM header, from a SID's HVSC song length (one full pass), or from the audio:
// chip2mp3 --endless plays past tagged lengths, and the render is
// autocorrelated to find where it repeats. A song with no loop gets exactly
// what chiptune.app plays (its own length and fade).
//
// chip2mp3 and HVSC's Songlengths.md5 are downloaded into _bin the first time
// they're needed. chip2mp3's repository is private, so its builds are kept
// (privately) on Spaces under music/bin/chip2mp3-<version>/, put there by
// scripts/upload-chip2mp3.js; CHIP2MP3 can point at a local build instead.

import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import ffmpegPath from 'ffmpeg-static';
import { readStored } from './music-storage.js';

// Formats chip2mp3 plays that aren't plain audio or tracker modules
export const CHIP_EXTENSIONS = ['nsf', 'nsfe', 'spc', 'gbs', 'ay', 'hes', 'kss', 'sap', 'vgm', 'vgz', 'gym', 's98', 'dro',
	'sid', 'mus', 'usf', 'miniusf', 'gsf', 'minigsf', 'mdx', 'v2m', 'mid', 'midi', 'smf', 'rmi', 'kar'];
// Files other songs load from beside them, rather than songs themselves
export const SIDECAR_EXTENSIONS = ['gsflib', 'usflib', 'pdx'];
const MIDI_EXTENSIONS = ['mid', 'midi', 'smf', 'rmi', 'kar'];

// The chip2mp3 build that's used: its commit, which must have --endless
export const CHIP2MP3_VERSION = '1216a6c';
const SONGLENGTHS_URL = 'https://hvsc.c64.org/download/C64Music/DOCUMENTS/Songlengths.md5';
const BIN = path.resolve('_bin');

const FADE = 8;
const SHORT_SONG = 60;       // only songs shorter than this (intro + one loop) repeat...
const LOOPS = 3;             // ...up to this many times...
const LOOP_LIMIT = 150;      // ...while that stays within 2:30
const MAX_SECONDS = 420;     // cap on intro + loops
const ANALYSE_SECONDS = 480; // how much is rendered to find the loop
const RATE = 8000;           // analysis sample rate
const HOP = 160;             // analysis frames of 20ms
const FPS = RATE / HOP;
const BINS = 128;
const MIN_OVERLAP = 20;      // seconds of repeat that must be heard to trust a loop
const MIN_MATCH = 0.85;      // how alike a loop and its repeat must be
const MIDI_MIN_MATCH = 0.7;  // ...for MIDI, when the file's length confirms the loop

export function isChipFile (name) {
	return CHIP_EXTENSIONS.includes(extension(name));
}

// Renders `file` (with any sidecar files already beside it) to an mp3.
// `track` counts from 0, like chiptune.app's ?subtune=. Returns {buffer, seconds, how}.
export async function renderChip (file, track = 0) {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chip-render-'));
	try {
		const ext = extension(file);
		let wav, seconds, how, natural = false;

		const vgm = ['vgm', 'vgz'].includes(ext) ? vgmLoop(fs.readFileSync(file)) : null;
		if (vgm) {
			const loops = vgm.loop ? loopCount(vgm.intro, vgm.loop) : 1;
			seconds = vgm.loop ? vgm.intro + vgm.loop * loops : vgm.intro;
			how = vgm.loop ? 'vgm header: ' + describe(vgm.intro, loops, vgm.loop) : 'vgm header, no loop';
			wav = await chip2mp3(file, track, tmp, Math.min(seconds, MAX_SECONDS) + FADE);
		}
		else {
			wav = await chip2mp3(file, track, tmp, ANALYSE_SECONDS);
			const hvsc = ext === 'sid' ? await hvscLength(file, track) : null;
			let found = hvsc ? {intro: 0, loop: hvsc, match: 1} : null;
			if (!found) {
				const analysis = await analyse(wav);
				const midi = MIDI_EXTENSIONS.includes(ext);
				found = findLoop(analysis, MIN_MATCH, midi ? 0.15 : 0.1);
				if (!found && midi) {
					// MIDI doesn't play endlessly, so the render is the file's own length. Soundfont playback
					// isn't sample-exact, so a written-out repeat matches less well; accept it when the
					// file's length is a whole number of loops
					const length = analysis.frames / FPS;
					const weak = findLoop(analysis, MIDI_MIN_MATCH, 0.15);
					if (weak && Math.round(length / weak.loop) >= 2 && Math.abs(length / weak.loop - Math.round(length / weak.loop)) < 0.05) found = weak;
				}
			}
			if (found) {
				const loops = loopCount(found.intro, found.loop);
				seconds = found.intro + found.loop * loops;
				how = (hvsc ? 'HVSC length: ' : 'loop found (match ' + found.match.toFixed(2) + '): ') + describe(found.intro, loops, found.loop);
			}
			else {
				wav = await chip2mp3(file, track, tmp, null);
				natural = true;
				how = 'no loop found, chiptune.app length';
			}
		}

		const peak = await peakDb(wav);
		if (peak < -60) throw new Error('This file renders as silence.');
		const gain = (-1 - peak).toFixed(2) + 'dB';
		const mp3Args = ['-vn', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', 'pipe:1'];
		let args;
		if (natural) args = ['-i', wav, '-af', 'volume=' + gain, ...mp3Args];
		else {
			seconds = Math.min(seconds, MAX_SECONDS);
			args = ['-i', wav, '-t', (seconds + FADE).toFixed(2), '-af', 'volume=' + gain + ',afade=t=out:st=' + seconds.toFixed(2) + ':d=' + FADE, ...mp3Args];
		}
		const {stdout, stderr, code} = await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args]);
		if (code || !stdout.length) throw new Error('Could not encode the rendered song: ' + stderr.trim().split('\n').pop());
		return {buffer: stdout, seconds: natural ? null : seconds + FADE, how};
	}
	finally {
		fs.rmSync(tmp, {recursive: true, force: true});
	}
}

function describe (intro, loops, loop) {
	return (intro >= 0.5 ? intro.toFixed(1) + 's intro + ' : '') + (loops > 1 ? loops + ' x ' : '') + loop.toFixed(1) + 's loop';
}

// User rule: only songs under a minute repeat, up to LOOPS times but never past LOOP_LIMIT
function loopCount (intro, loop) {
	if (intro + loop >= SHORT_SONG) return 1;
	return Math.max(1, Math.min(LOOPS, Math.floor((LOOP_LIMIT - intro) / loop)));
}

// Renders a track to a wav: played endlessly up to `seconds`, or with no
// `seconds`, exactly as chiptune.app plays it
async function chip2mp3 (file, track, folder, seconds) {
	const exe = await chip2mp3Path();
	const out = fs.mkdtempSync(path.join(folder, 'wav-'));
	const args = ['--no-pause', '-q', '-j', '1', '--wav', '-r', '44100', '--no-zxtune', '--subtune', String(track + 1), '-o', out];
	const songlengths = await songlengthsPath().catch(() => null);
	if (songlengths) args.push('--songlengths', songlengths);
	if (seconds) args.push('--endless', '--max-length', seconds.toFixed(2));
	const {stdout, stderr, code} = await run(exe, [...args, file]);
	const wav = findFiles(out, '.wav')[0];
	if (code || !wav) throw new Error('chip2mp3 could not render this file: ' + (stdout + stderr).toString().trim().split('\n').pop());
	return wav;
}

let downloading = null;
async function chip2mp3Path () {
	if (process.env.CHIP2MP3) return process.env.CHIP2MP3;
	const name = process.platform === 'win32' ? 'chip2mp3.exe' : 'chip2mp3';
	const exe = path.join(BIN, 'chip2mp3-' + CHIP2MP3_VERSION, name);
	if (fs.existsSync(exe)) return exe;
	downloading ||= (async () => {
		const binary = await readStored('bin/chip2mp3-' + CHIP2MP3_VERSION + '/' + name);
		if (!binary) throw new Error('chip2mp3 ' + CHIP2MP3_VERSION + ' is not on Spaces (scripts/upload-chip2mp3.js puts it there), and CHIP2MP3 is not set.');
		fs.mkdirSync(path.dirname(exe), {recursive: true});
		fs.writeFileSync(exe + '.part', binary, {mode: 0o755});
		fs.renameSync(exe + '.part', exe);
	})().finally(() => downloading = null);
	await downloading;
	return exe;
}

let songlengths = null;
function songlengthsPath () {
	const file = path.join(BIN, 'Songlengths.md5');
	songlengths ||= (async () => {
		const stale = !fs.existsSync(file) || Date.now() - fs.statSync(file).mtimeMs > 30 * 24 * 3600 * 1000;
		if (stale) {
			const response = await fetch(SONGLENGTHS_URL);
			if (!response.ok) {
				if (fs.existsSync(file)) return file;
				throw new Error('Could not download Songlengths.md5 (' + response.status + ').');
			}
			fs.mkdirSync(BIN, {recursive: true});
			fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
		}
		return file;
	})().catch(err => { songlengths = null; throw err; });
	return songlengths;
}

// A SID subtune's length from HVSC's Songlengths.md5, which is keyed by the md5 of the whole file
async function hvscLength (file, track) {
	const list = await songlengthsPath().catch(() => null);
	if (!list) return null;
	const md5 = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
	const text = fs.readFileSync(list, 'latin1');
	const at = text.indexOf('\n' + md5 + '=');
	if (at < 0) return null;
	const lengths = text.slice(at + 34, text.indexOf('\n', at + 1)).trim().split(' ');
	const [minutes, secs] = lengths[Math.min(track, lengths.length - 1)].split(':');
	return Number(minutes) * 60 + parseFloat(secs) || null;
}

// The intro and loop a VGM's header gives, in seconds
function vgmLoop (data) {
	if (data[0] === 0x1f && data[1] === 0x8b) data = zlib.gunzipSync(data);
	if (data.toString('latin1', 0, 4) !== 'Vgm ') return null;
	const total = data.readUInt32LE(0x18), loopOffset = data.readUInt32LE(0x1c), loop = data.readUInt32LE(0x20);
	if (!loopOffset || !loop) return {intro: total / 44100, loop: null};
	return {intro: (total - loop) / 44100, loop: loop / 44100};
}

async function peakDb (wav) {
	const {stderr} = await run(ffmpegPath, ['-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-']);
	const match = stderr.toString().match(/max_volume:\s*(-?[\d.]+|-inf) dB/);
	return match && match[1] !== '-inf' ? Number(match[1]) : -Infinity;
}

// A log spectrogram of the song (BINS bands every 20ms), each band's mean removed
async function analyse (wav) {
	const {stdout} = await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-']);
	const samples = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 2));
	const SIZE = 1024;
	const frames = Math.max(0, Math.floor((samples.length - SIZE) / HOP) + 1);
	const spec = new Float32Array(frames * BINS);
	const window = new Float64Array(SIZE).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (SIZE - 1)));
	const re = new Float64Array(SIZE), im = new Float64Array(SIZE);
	for (let f = 0; f < frames; f++) {
		for (let i = 0; i < SIZE; i++) { re[i] = samples[f * HOP + i] / 32768 * window[i]; im[i] = 0; }
		fft(re, im);
		for (let b = 0; b < BINS; b++) {
			// two FFT bins per band, up to 4kHz
			const m = Math.hypot(re[b * 2], im[b * 2]) + Math.hypot(re[b * 2 + 1], im[b * 2 + 1]);
			spec[f * BINS + b] = Math.log1p(500 * m);
		}
	}
	for (let b = 0; b < BINS; b++) {
		let mean = 0;
		for (let f = 0; f < frames; f++) mean += spec[f * BINS + b];
		mean /= frames || 1;
		for (let f = 0; f < frames; f++) spec[f * BINS + b] -= mean;
	}
	return {spec, frames};
}

// {intro, loop, match} in seconds, or null if the audio doesn't repeat
function findLoop ({spec, frames: n}, minMatch, fractionTolerance) {
	const minLag = 3 * FPS, maxLag = n - MIN_OVERLAP * FPS;
	if (n === 0 || maxLag <= minLag) return null;

	// autocorrelation of every band at once, through the FFT
	let size = 1;
	while (size < n * 2) size <<= 1;
	const ac = new Float64Array(n);
	const re = new Float64Array(size), im = new Float64Array(size);
	for (let b = 0; b < BINS; b++) {
		re.fill(0); im.fill(0);
		for (let f = 0; f < n; f++) re[f] = spec[f * BINS + b];
		fft(re, im);
		for (let i = 0; i < size; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0; }
		fft(re, im);  // the spectrum is real and even, so a forward FFT inverts it
		for (let l = 0; l < n; l++) ac[l] += re[l] / size;
	}
	const energy = new Float64Array(n);
	for (let f = 0, sum = 0; f < n; f++) {
		for (let b = 0; b < BINS; b++) sum += spec[f * BINS + b] ** 2;
		energy[f] = sum;
	}
	const norm = new Float64Array(n).fill(-1);
	let best = -1;
	for (let l = minLag; l < maxLag; l++) {
		norm[l] = ac[l] / Math.sqrt(energy[n - l - 1] * (energy[n - 1] - energy[l - 1]) + 1e-9);
		if (norm[l] > best) best = norm[l];
	}
	if (best < minMatch) return null;
	let period = minLag;
	while (norm[period] < best - 0.02) period++;

	// Whole multiples of the loop line up too, and with soundfonts or heavy echo
	// they can score a little higher than the loop itself. A fraction of the lag
	// (1/6 .. 1/2) is the real loop only if every multiple of it lines up as well -
	// a section repeated inside the song fails at 3x, which is 1.5 loops.
	const scoreAt = t => {
		let top = -1, at = 0;
		for (let l = Math.max(minLag, Math.round(t - FPS)); l <= Math.min(maxLag - 1, Math.round(t + FPS)); l++) if (norm[l] > top) { top = norm[l]; at = l; }
		return {score: top, at};
	};
	for (let k = 6; k >= 2; k--) {
		const guess = period / k;
		if (guess < minLag) continue;
		const multiples = [];
		for (let m = 1; guess * m < maxLag; m++) multiples.push(scoreAt(guess * m).score);
		if (multiples.length >= 3 && Math.min(...multiples) >= best - fractionTolerance) {
			({score: best, at: period} = scoreAt(guess));
			break;
		}
	}

	// the intro ends where frames start matching the frame one loop later
	const run = 2 * FPS;
	let intro = 0, window = 0;
	const sims = new Float64Array(n - period);
	for (let f = 0; f < n - period; f++) {
		let dot = 0, a = 0, c = 0;
		for (let b = 0; b < BINS; b++) {
			const x = spec[f * BINS + b], y = spec[(f + period) * BINS + b];
			dot += x * y; a += x * x; c += y * y;
		}
		sims[f] = dot / (Math.sqrt(a * c) + 1e-9);
		window += sims[f];
		if (f >= run) window -= sims[f - run];
		if (f >= run - 1 && window / run > best - 0.05) { intro = f - run + 1; break; }
	}
	return {intro: intro / FPS, loop: period / FPS, match: best};
}

// In-place radix-2 FFT
function fft (re, im) {
	const n = re.length;
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
	}
	for (let len = 2; len <= n; len <<= 1) {
		const angle = -2 * Math.PI / len, wr = Math.cos(angle), wi = Math.sin(angle);
		for (let i = 0; i < n; i += len) {
			let cr = 1, ci = 0;
			for (let j = 0; j < len / 2; j++) {
				const a = i + j, b = a + len / 2;
				const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
				re[b] = re[a] - tr; im[b] = im[a] - ti;
				re[a] += tr; im[a] += ti;
				const next = cr * wr - ci * wi;
				ci = cr * wi + ci * wr; cr = next;
			}
		}
	}
}

function extension (name) {
	return path.extname(String(name)).slice(1).toLowerCase();
}

function findFiles (folder, ext) {
	const found = [];
	for (const entry of fs.readdirSync(folder, {withFileTypes: true})) {
		const full = path.join(folder, entry.name);
		if (entry.isDirectory()) found.push(...findFiles(full, ext));
		else if (entry.name.toLowerCase().endsWith(ext)) found.push(full);
	}
	return found;
}

function run (command, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
		const stdout = [], stderr = [];
		child.stdout.on('data', data => stdout.push(data));
		child.stderr.on('data', data => stderr.push(data));
		child.on('error', reject);
		child.on('close', code => resolve({stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString(), code}));
	});
}

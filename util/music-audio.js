// Turning other audio formats into mp3s, and measuring how loud songs are.
//
// ffmpeg handles ordinary audio files. Tracker modules are rendered with
// libopenmpt instead, from the WebAssembly build in the chiptune3 package,
// because the ffmpeg-static build for linux is compiled without it.

import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';

export const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'oga', 'opus', 'wav', 'flac', 'm4a', 'aac', 'aif', 'aiff', 'wma'];
export const TRACKER_EXTENSIONS = ['mod', 'xm', 's3m', 'it', 'mptm', 'mo3', '669', 'amf', 'ams', 'dbm', 'digi', 'dmf', 'dsm',
	'far', 'gdm', 'imf', 'mdl', 'med', 'mtm', 'okt', 'plm', 'psm', 'ptm', 'stm', 'ult', 'umx', 'mt2'];

const RENDER_RATE = 48000;
const RENDER_CHUNK = 8192;
const MAX_RENDER_SECONDS = 20 * 60;

// What everything is levelled to, in LUFS as measured through LISTENING_WEIGHT
const TARGET_LOUDNESS = -16;

// Plain LUFS counts bass nearly in full, which suits loud listening on good
// speakers. In a voice channel - background volume, headphones and laptop
// speakers - bass sounds far quieter than it measures and the 1-5kHz range
// louder, so a bassy song levelled by LUFS alone sounds much quieter than a
// bright square-wave one. Loudness is measured through this to make up for it.
const LISTENING_WEIGHT = 'highpass=f=150:poles=2,highpass=f=150:poles=2,equalizer=f=3000:t=o:w=2:g=6';

// Bumped whenever the measurement changes, so older measurements are redone
export const LEVEL_VERSION = 2;
// A quiet song is only turned up until its peaks would need this much limiting
const MAX_LIMITING = 3;

export function extensionOf (name) {
	return path.extname(String(name)).slice(1).toLowerCase();
}

export function isSupported (name) {
	const extension = extensionOf(name);
	return AUDIO_EXTENSIONS.includes(extension) || TRACKER_EXTENSIONS.includes(extension);
}

// Returns {name, buffer} as an mp3. Mp3s are returned untouched.
export async function toMp3 (name, buffer) {
	const extension = extensionOf(name);
	if (extension === 'mp3') return {name, buffer};

	const mp3Name = path.basename(name, path.extname(name)) + '.mp3';
	const mp3Args = ['-vn', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-q:a', '2', '-f', 'mp3', 'pipe:1'];

	if (TRACKER_EXTENSIONS.includes(extension)) {
		const pcm = await renderModule(buffer);
		return {name: mp3Name, buffer: await ffmpeg(['-f', 'f32le', '-ar', String(RENDER_RATE), '-ac', '2', '-i', 'pipe:0', ...mp3Args], pcm)};
	}
	if (AUDIO_EXTENSIONS.includes(extension))
		return {name: mp3Name, buffer: await ffmpeg(['-i', 'pipe:0', ...mp3Args], buffer)};

	throw new Error('.' + extension + ' files are not supported.');
}

// Integrated loudness (LUFS) and true peak (dBTP) of a song
// Loudness is measured through LISTENING_WEIGHT, but the true peak on the
// song as it is, since that is what the limiter has to keep from clipping
export async function measure (buffer) {
	const {stderr} = await run(['-nostats', '-i', 'pipe:0', '-filter_complex',
		'asplit=2[full][weighted];'
		+ '[full]ebur128=peak=true:framelog=quiet[out];'
		+ '[weighted]' + LISTENING_WEIGHT + ',ebur128=framelog=quiet,anullsink',
		'-map', '[out]', '-f', 'null', '-'], buffer);
	let loudness, peak;
	for (const summary of stderr.split('Summary:').slice(1)) {
		if (/Peak:/.test(summary)) peak = Number(summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/)?.[1]);
		else loudness = Number(summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/)?.[1]);
	}
	if (!Number.isFinite(loudness) || !Number.isFinite(peak)) throw new Error('Could not measure the loudness of this song.');
	return {loudness, peak, version: LEVEL_VERSION};
}

// The ffmpeg filter that brings a measured song to the target loudness
export function levelFilter (level) {
	if (!level) return null;
	let gain = TARGET_LOUDNESS - level.loudness;
	if (gain > 0) gain = Math.min(gain, -1 - level.peak + MAX_LIMITING);
	gain = Math.round(gain * 10) / 10;
	if (Math.abs(gain) < 0.5) return null;
	const filter = 'volume=' + gain + 'dB';
	return level.peak + gain > -1 ? filter + ',alimiter=limit=0.89:level=false' : filter;
}

let libopenmpt;
async function renderModule (buffer) {
	libopenmpt ||= await (await import('chiptune3/libopenmpt.worklet.js')).default();
	const lib = libopenmpt;

	const filePointer = lib._malloc(buffer.length);
	lib.HEAPU8.set(buffer, filePointer);
	const module = lib._openmpt_module_create_from_memory(filePointer, buffer.length, 0, 0, 0);
	lib._free(filePointer);
	if (!module) throw new Error('This is not a tracker module libopenmpt can read.');

	const audioPointer = lib._malloc(RENDER_CHUNK * 2 * 4);
	const chunks = [];
	try {
		lib._openmpt_module_set_repeat_count(module, 0);
		let frames = 0, read;
		while ((read = lib._openmpt_module_read_interleaved_float_stereo(module, RENDER_RATE, RENDER_CHUNK, audioPointer)) > 0) {
			chunks.push(Buffer.from(lib.HEAPU8.slice(audioPointer, audioPointer + read * 2 * 4)));
			frames += read;
			if (frames > RENDER_RATE * MAX_RENDER_SECONDS) break;
		}
	}
	finally {
		lib._openmpt_module_destroy(module);
		lib._free(audioPointer);
	}
	if (!chunks.length) throw new Error('This module has no audio.');
	return Buffer.concat(chunks);
}

async function ffmpeg (args, input) {
	const {stdout, stderr, code} = await run(args, input);
	if (code !== 0 || !stdout.length) throw new Error('Could not convert this file: ' + (stderr.trim().split('\n').pop() || 'ffmpeg exited with ' + code));
	return stdout;
}

function run (args, input) {
	return new Promise((resolve, reject) => {
		const process = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'info', ...args], {stdio: ['pipe', 'pipe', 'pipe']});
		const stdout = [], stderr = [];
		process.stdout.on('data', data => stdout.push(data));
		process.stderr.on('data', data => stderr.push(data));
		process.stdin.on('error', () => {});
		process.on('error', reject);
		process.on('close', code => resolve({stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString(), code}));
		process.stdin.end(input);
	});
}

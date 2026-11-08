// The title, artist and game a game-music or tracker file names itself, from the
// same header fields chiptune.app reads (chip-player-js scripts/metadata-parsers.js).
// Tracker modules only have a title field, but musicians usually credit
// themselves in the instrument or sample names ("arachno \ coolphat",
// "music by ..."), so those are searched for an artist too.

import zlib from 'zlib';
import path from 'path';

// {title, artist, game}, any of which may be missing
export function songMeta (file, data, track = 0) {
	const ext = path.extname(file).slice(1).toLowerCase();
	try {
		const parser = PARSERS[ext];
		const meta = parser ? parser(data, track) : {};
		for (const key of Object.keys(meta)) {
			meta[key] = clean(meta[key]);
			if (!meta[key] || /^(<\?>|\?+|unknown|untitled|none|-)$/i.test(meta[key])) delete meta[key];
		}
		return meta;
	}
	catch {
		return {};
	}
}

const PARSERS = {
	vgm: vgm,
	vgz: data => vgm(data[0] === 0x1f && data[1] === 0x8b ? zlib.gunzipSync(data) : data),
	nsf: data => ({game: text(data, 0x0e, 0x2e), artist: text(data, 0x2e, 0x4e)}),
	gbs: data => ({game: text(data, 0x10, 0x30), artist: text(data, 0x30, 0x50)}),
	nsfe: nsfe,
	spc: data => data.length >= 0x100 && data[0x23] === 0x1a
		? {title: text(data, 0x2e, 0x4e), game: text(data, 0x4e, 0x6e), artist: text(data, 0xb1, 0xd1)} : {},
	sid: data => ({title: text(data, 0x16, 0x36), artist: text(data, 0x36, 0x56)}),
	minigsf: psf, gsf: psf, miniusf: psf, usf: psf,
	mod: data => tracker(data, text(data, 0, 20), modNames(data)),
	xm: data => tracker(data, text(data, 17, 37), xmNames(data)),
	it: data => tracker(data, text(data, 4, 30), itNames(data)),
	s3m: data => tracker(data, text(data, 0, 28), s3mNames(data)),
};

function vgm (data) {
	if (data.toString('latin1', 0, 4) !== 'Vgm ') return {};
	const at = 0x14 + data.readUInt32LE(0x14);
	if (!data.readUInt32LE(0x14) || data.toString('latin1', at, at + 4) !== 'Gd3 ') return {};
	// GD3: UTF-16 strings - track, track (JP), game, game (JP), system, system (JP), author, author (JP)...
	const strings = data.toString('utf16le', at + 12, at + 12 + data.readUInt32LE(at + 8)).split('\0');
	return {title: strings[0], game: strings[2], artist: strings[6]};
}

function nsfe (data, track) {
	const meta = {};
	for (let at = 4; at + 8 <= data.length;) {
		const size = data.readUInt32LE(at), id = data.toString('latin1', at + 4, at + 8), body = data.subarray(at + 8, at + 8 + size);
		if (id === 'auth') [meta.game, meta.artist] = body.toString('latin1').split('\0');
		if (id === 'tlbl') meta.title = body.toString('latin1').split('\0')[track];
		if (id === 'NEND') break;
		at += 8 + size;
	}
	return meta;
}

function psf (data) {
	const at = 16 + data.readUInt32LE(4) + data.readUInt32LE(8);
	const tags = data.toString('utf8', at);
	if (!tags.startsWith('[TAG]')) return {};
	const get = name => tags.slice(5).match(new RegExp('^' + name + '=(.*)$', 'mi'))?.[1];
	return {title: get('title'), artist: get('artist'), game: get('game')};
}

// A tracker module's title, and an artist credited in its instrument/sample names
function tracker (data, title, names) {
	return {title, artist: creditIn(names)};
}

// Who a module's instrument and sample names credit, or nothing
export function creditIn (names) {
	const lines = names.map(clean).filter(Boolean);
	for (const line of lines) {
		// "music by arachno", "composed by: x", "(c) x"
		const by = line.match(/^(?:.*\b(?:music|composed|written|made|tune|song|module)\s+)?by[:\s]+([^\s/\\|,;!()[\]{}<>@#][^/\\|,;!()[\]{}<>@#]{1,24}?)(?:\s*[/\\|,;!(<@#]|$)/i)
			|| line.match(/^\(c\)\s*\d*\s*([^\s/\\|,;!()[\]{}<>@][^/\\|,;!()[\]{}<>@]{1,24}?)(?:\s*[/\\|,;!(<@]|$)/i);
		if (by) return by[1].trim();
		// "arachno \ coolphat" or "arachno / tump": artist then group
		const group = line.match(/^([A-Za-z0-9][\w.'-]{1,19})\s*[\\/|#]\s*[A-Za-z0-9][\w .'-]{1,24}$/);
		if (group && !/\.(wav|aif|aiff|smp|raw|iff|8svx)$/i.test(line)) return group[1];
	}
	return undefined;
}

function modNames (data) {
	const names = [];
	for (let i = 0; i < 31 && 20 + i * 30 + 22 <= data.length; i++) names.push(text(data, 20 + i * 30, 20 + i * 30 + 22));
	return names;
}

function xmNames (data) {
	if (data.toString('latin1', 0, 17) !== 'Extended Module: ') return [];
	const names = [];
	let at = 60 + data.readUInt32LE(60);
	const patterns = data.readUInt16LE(70), instruments = data.readUInt16LE(72);
	for (let p = 0; p < patterns && at + 9 <= data.length; p++) at += data.readUInt32LE(at) + data.readUInt16LE(at + 7);
	for (let i = 0; i < instruments && at + 29 <= data.length; i++) {
		const size = data.readUInt32LE(at), samples = data.readUInt16LE(at + 27);
		names.push(text(data, at + 4, at + 26));
		let sampleAt = at + size, total = 0;
		for (let s = 0; s < samples && sampleAt + 40 <= data.length; s++) {
			total += data.readUInt32LE(sampleAt);
			names.push(text(data, sampleAt + 18, sampleAt + 40));
			sampleAt += 40;
		}
		at = sampleAt + total;
	}
	return names;
}

function itNames (data) {
	if (data.toString('latin1', 0, 4) !== 'IMPM') return [];
	const orders = data.readUInt16LE(0x20), instruments = data.readUInt16LE(0x22), samples = data.readUInt16LE(0x24);
	const names = [];
	for (let i = 0; i < instruments; i++) { const at = data.readUInt32LE(0xc0 + orders + i * 4); names.push(text(data, at + 0x20, at + 0x3a)); }
	for (let i = 0; i < samples; i++) { const at = data.readUInt32LE(0xc0 + orders + instruments * 4 + i * 4); names.push(text(data, at + 0x14, at + 0x2e)); }
	// the song message often credits the author
	const messageLength = data.readUInt16LE(0x36), messageAt = data.readUInt32LE(0x38);
	if (messageLength && messageAt) names.push(...text(data, messageAt, messageAt + messageLength).split(/\r\n?|\n/));
	return names;
}

function s3mNames (data) {
	if (data.toString('latin1', 0x2c, 0x30) !== 'SCRM') return [];
	const orders = data.readUInt16LE(0x20), instruments = data.readUInt16LE(0x22);
	const names = [];
	for (let i = 0; i < instruments; i++) names.push(text(data, data.readUInt16LE(0x60 + orders + i * 2) * 16 + 0x30, data.readUInt16LE(0x60 + orders + i * 2) * 16 + 0x4c));
	return names;
}

function text (data, start, end) {
	if (start >= data.length) return '';
	const bytes = data.subarray(start, Math.min(end, data.length));
	const zero = bytes.indexOf(0);
	return bytes.subarray(0, zero < 0 ? bytes.length : zero).toString('latin1');
}

function clean (value) {
	return String(value ?? '').replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.\-_~=*]+|[\s.\-_~=*]+$/g, '').trim();
}

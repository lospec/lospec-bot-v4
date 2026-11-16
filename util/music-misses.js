// Songs people tried to add that the bot couldn't: chiptune.app links whose id
// isn't in the index or whose file couldn't be downloaded from gifx.co, and files
// in formats it can't play. They're kept privately on Spaces - the list in
// music/misses.json, and each unplayable file under music/misses/ - so they can
// be tried again when the index grows or a format is added.
// scripts/music-misses.js lists them, fetches the files and clears them.

import crypto from 'crypto';
import { readStored, store, useSpaces } from './music-storage.js';

const LIST = 'misses.json';
const MAX_KEPT_BYTES = 20 * 1024 * 1024;

export async function readMisses () {
	const data = await readStored(LIST);
	return data ? JSON.parse(data.toString('utf8')) : {};
}

export async function writeMisses (misses) {
	await store(LIST, Buffer.from(JSON.stringify(misses, null, '\t')), 'application/json');
}

// Writes are queued so two at once don't lose one another's entry
let queue = Promise.resolve();
function update (change) {
	queue = queue.then(async () => {
		const misses = await readMisses();
		await change(misses);
		await writeMisses(misses);
	}).catch(err => console.error('Could not record a song the bot could not add:', err.message));
	return queue;
}

function keyOf (text) {
	return crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function note (misses, key, entry, user) {
	const now = new Date().toISOString();
	const old = misses[key] || {};
	misses[key] = {...old, ...entry, users: [...new Set([...(old.users || []), user].filter(Boolean))],
		first: old.first || now, last: now, count: (old.count || 0) + 1};
}

// A chiptune.app or gifx.co link that couldn't be added. `link` is what
// parseLink() made of it; `reason` is 'not indexed' (an id with no index entry)
// or 'not downloadable' (indexed, but no gifx.co copy matched or could be fetched)
export function recordLinkMiss ({text, link, station, reason, user}) {
	if (!useSpaces) return Promise.resolve();
	const key = keyOf(link.id ? 'id:' + link.id + ':' + link.track : 'path:' + link.path + ':' + link.track);
	return update(misses => note(misses, key, {kind: 'link', link: String(text).trim(), id: link.id, path: link.path,
		track: link.track, station, reason}, user));
}

// A file in a format the bot can't play (or render), kept so it can be
// rendered once the format is supported
export function recordFormatMiss ({name, data, station, reason, user}) {
	if (!useSpaces) return Promise.resolve();
	const md5 = crypto.createHash('md5').update(data).digest('hex');
	const key = keyOf('file:' + md5);
	const ext = (String(name).match(/\.([^.\/\\]+)$/)?.[1] || 'bin').toLowerCase();
	const file = data.length <= MAX_KEPT_BYTES ? 'misses/' + md5 + '.' + ext : null;
	return update(async misses => {
		if (file && !misses[key]) await store(file, data);
		note(misses, key, {kind: 'file', name, ext, file, station, reason}, user);
	});
}

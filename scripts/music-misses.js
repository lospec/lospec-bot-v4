// The songs people tried to add that the bot couldn't (util/music-misses.js):
// chiptune.app/gifx.co links that weren't indexed or downloadable, and files in
// formats it couldn't play. Needs SPACES_KEY and SPACES_SECRET.
//
//   node scripts/music-misses.js              list them, one per line:
//                                             key, kind, reason, station, count, last tried, link or file name
//   node scripts/music-misses.js --json       the whole record
//   node scripts/music-misses.js get <folder> download the kept files, as <key>.<ext>
//   node scripts/music-misses.js done <key>... remove entries (and their kept files) once handled

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { readStored, removeStored, useSpaces } from '../util/music-storage.js';
import { readMisses, writeMisses } from '../util/music-misses.js';

if (!useSpaces) {
	console.error('Set SPACES_KEY and SPACES_SECRET: the misses are kept on Spaces.');
	process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
const misses = await readMisses();

if (command === '--json') {
	console.log(JSON.stringify(misses, null, '\t'));
}
else if (command === 'get') {
	const folder = rest[0];
	if (!folder) throw new Error('usage: node scripts/music-misses.js get <folder>');
	fs.mkdirSync(folder, {recursive: true});
	for (const [key, miss] of Object.entries(misses)) {
		if (!miss.file) continue;
		const data = await readStored(miss.file);
		if (!data) { console.error(key + ': ' + miss.file + ' is gone'); continue; }
		const out = path.join(folder, key + '.' + miss.ext);
		fs.writeFileSync(out, data);
		console.log(out + '\t' + miss.name);
	}
}
else if (command === 'done') {
	for (const key of rest) {
		if (!misses[key]) { console.error(key + ' is not recorded'); continue; }
		if (misses[key].file && !Object.entries(misses).some(([other, miss]) => other !== key && miss.file === misses[key].file))
			await removeStored(misses[key].file);
		delete misses[key];
		console.log('removed ' + key);
	}
	await writeMisses(misses);
}
else if (!command) {
	for (const [key, miss] of Object.entries(misses).sort((a, b) => b[1].last.localeCompare(a[1].last)))
		console.log([key, miss.kind, miss.reason, miss.station, miss.count, miss.last.slice(0, 10), miss.kind === 'link' ? miss.link : miss.name].join('\t'));
}
else {
	console.error('usage: node scripts/music-misses.js [--json | get <folder> | done <key>...]');
	process.exit(1);
}

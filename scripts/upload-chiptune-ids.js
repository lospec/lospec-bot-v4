// Puts the chiptune.app id index on Spaces (privately), where /music-upload's
// link option looks ids up (util/chiptune-links.js). Each .tsv in the folder is
// "id <TAB> catalog path [<TAB> other possible path...]" per line; an ids.json
// of {id: {path}} is uploaded as manual.tsv. Needs SPACES_KEY and SPACES_SECRET.
//
// node scripts/upload-chiptune-ids.js <folder>

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { store } from '../util/music-storage.js';

const folder = process.argv[2];
if (!folder) {
	console.error('usage: node scripts/upload-chiptune-ids.js <folder>');
	process.exit(1);
}

const files = [];
const collections = path.join(folder, 'collections');
for (const dir of [folder, collections].filter(d => fs.existsSync(d)))
	for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.tsv')))
		files.push({name, data: fs.readFileSync(path.join(dir, name))});
const manual = path.join(folder, 'ids.json');
if (fs.existsSync(manual)) {
	const ids = JSON.parse(fs.readFileSync(manual, 'utf8'));
	files.push({name: 'manual.tsv', data: Buffer.from(Object.entries(ids).map(([id, {path: p}]) => id + '\t' + p + '\n').join(''))});
}
for (const {name, data} of files) {
	await store('chiptune-ids/' + name, data, 'text/tab-separated-values');
	console.log('uploaded', name, (data.length / 1e6).toFixed(1) + 'MB', data.toString().split('\n').filter(Boolean).length, 'ids');
}

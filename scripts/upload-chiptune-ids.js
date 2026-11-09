// Puts the chiptune.app id index on Spaces (privately), where /music-upload's
// link option looks ids up (util/chiptune-links.js). Every .tsv in the folder (and
// its collections/ folder) is "id <TAB> catalog path [<TAB> other possible path...]"
// per line; an ids.json of {id: {path}} counts too. They're merged - an id found in
// several collections keeps every candidate path - and split into one shard per
// first character of the id, so the bot only ever reads a small file.
// Needs SPACES_KEY and SPACES_SECRET.
//
// node scripts/upload-chiptune-ids.js <folder>

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { store, listStored, removeStored } from '../util/music-storage.js';
import { shardOf } from '../util/chiptune-links.js';

const folder = process.argv[2];
if (!folder) {
	console.error('usage: node scripts/upload-chiptune-ids.js <folder>');
	process.exit(1);
}

const shards = new Map();  // shard -> Map(id -> [paths])
function add (id, paths) {
	const shard = shardOf(id);
	if (!shards.has(shard)) shards.set(shard, new Map());
	const ids = shards.get(shard);
	const known = ids.get(id) || [];
	for (const p of paths) if (p && !known.includes(p)) known.push(p);
	ids.set(id, known);
}

const manual = path.join(folder, 'ids.json');
if (fs.existsSync(manual))  // hand-checked paths go first
	for (const [id, {path: p}] of Object.entries(JSON.parse(fs.readFileSync(manual, 'utf8')))) add(id, [p]);

const files = [];
for (const dir of [folder, path.join(folder, 'collections')].filter(d => fs.existsSync(d)))
	for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.tsv'))) files.push(path.join(dir, name));
for (const file of files.sort()) {
	let count = 0;
	for await (const line of readline.createInterface({input: fs.createReadStream(file), crlfDelay: Infinity})) {
		const [id, ...paths] = line.split('\t');
		if (!/^[A-Za-z0-9_-]{8}$/.test(id)) continue;
		add(id, paths);
		count++;
	}
	console.log(path.basename(file), count, 'ids');
}

let total = 0;
for (const [shard, ids] of [...shards].sort()) {
	const text = [...ids].sort(([a], [b]) => a < b ? -1 : 1).map(([id, paths]) => id + '\t' + paths.join('\t') + '\n').join('');
	await store('chiptune-ids/' + shard + '.tsv', Buffer.from(text), 'text/tab-separated-values');
	total += ids.size;
}
// anything else there (earlier uploads were one file per collection) isn't read any more
const current = new Set([...shards.keys()].map(shard => 'chiptune-ids/' + shard + '.tsv'));
for (const {name} of await listStored('chiptune-ids/'))
	if (!current.has(name)) { await removeStored(name); console.log('removed old', name); }
console.log('uploaded', shards.size, 'shards,', total, 'ids');

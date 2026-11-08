// Puts chip2mp3 builds on Spaces (privately) for util/chip-render.js, under the
// version util/chip-render.js asks for (CHIP2MP3_VERSION). Needs SPACES_KEY and
// SPACES_SECRET.
//
// node scripts/upload-chip2mp3.js <folder with chip2mp3 and/or chip2mp3.exe>

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { store } from '../util/music-storage.js';
import { CHIP2MP3_VERSION } from '../util/chip-render.js';

const folder = process.argv[2];
if (!folder) {
	console.error('usage: node scripts/upload-chip2mp3.js <folder with chip2mp3 and/or chip2mp3.exe>');
	process.exit(1);
}
let uploaded = 0;
for (const name of ['chip2mp3', 'chip2mp3.exe']) {
	const file = path.join(folder, name);
	if (!fs.existsSync(file)) continue;
	await store('bin/chip2mp3-' + CHIP2MP3_VERSION + '/' + name, fs.readFileSync(file));
	console.log('uploaded', name, 'as chip2mp3', CHIP2MP3_VERSION);
	uploaded++;
}
if (!uploaded) console.error('no chip2mp3 or chip2mp3.exe in', folder);

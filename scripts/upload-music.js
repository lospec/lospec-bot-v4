// Adds every song in a folder to a music station - mp3s as they are, other
// audio files and tracker modules converted to mp3 - skipping any already in
// the library. Uses the same storage as the bot, so set SPACES_KEY and
// SPACES_SECRET to upload to the CDN rather than ./_music.
//
// node scripts/upload-music.js <station> <folder>

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { STATIONS, addSong, loadLibrary } from '../util/music-library.js';
import { isSupported } from '../util/music-audio.js';

const [station, folder] = process.argv.slice(2);
if (!STATIONS[station] || !folder) {
	console.error('usage: node scripts/upload-music.js <' + Object.keys(STATIONS).join('|') + '> <folder>');
	process.exit(1);
}

await loadLibrary();

const files = fs.readdirSync(folder).filter(isSupported);
let added = 0;
for (const name of files) {
	try {
		await addSong(station, name, fs.readFileSync(path.join(folder, name)));
		console.log('added  ', name);
		added++;
	}
	catch (err) { console.log('skipped', name, '-', err.message); }
}
console.log(added + ' of ' + files.length + ' added to ' + station);

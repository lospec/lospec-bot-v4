// Renders game-music files to mp3 the same way the bot does for uploads
// (util/chip-render.js), e.g. to check a song's length before adding it.
//
// node scripts/render-chip.js <file> <out.mp3> [--track N]
//
// --track counts from 0, like chiptune.app's ?subtune=. Any .gsflib/.usflib/.pdx
// the file needs must be next to it.

import fs from 'fs';
import { renderChip } from '../util/chip-render.js';

const [file, out] = process.argv.slice(2);
const trackAt = process.argv.indexOf('--track');
const track = trackAt > 0 ? Number(process.argv[trackAt + 1]) : 0;
if (!file || !out) {
	console.error('usage: node scripts/render-chip.js <file> <out.mp3> [--track N]');
	process.exit(1);
}

const started = Date.now();
const {buffer, seconds, how} = await renderChip(file, track);
fs.writeFileSync(out, buffer);
console.log(out, (seconds ? Math.round(seconds) + 's' : ''), '(' + how + ')', ((Date.now() - started) / 1000).toFixed(1) + 's');

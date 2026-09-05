// The seed series - a folder of pixel art the treasury releases, one at a time,
// on a timer. This folder is the queue of LFTs waiting to enter circulation.
//
// A number in front of the filename is the LFT number that piece will be minted
// as, and is dropped from its name: `007-goober.png` becomes LFT #7, "Goober".
// LFTs are numbered in order, so each number goes to the file named for it if
// there is one, and to a random unnumbered piece if there is not.

import fsp from 'fs/promises';
import path from 'path';
import { LFT_DATA } from '../data.js';
import { normalizeName, titleFromName } from './lft.js';

export const SEED_PATH = 'lft-seed';

const NUMBER_PREFIX = /^(\d+)[-_. ]+/;


export function parseSeedFileName (file) {
	const base = path.basename(file, path.extname(file));
	const match = base.match(NUMBER_PREFIX);
	const number = match ? parseInt(match[1], 10) : null;
	const name = normalizeName(match ? base.slice(match[0].length) : base);

	//LFT numbers start at 1, so a leading zero on its own is not a number
	return {number: number >= 1 ? number : null, name, title: titleFromName(name)};
}


//every seed in the folder, without reading any of the images
export async function listSeeds () {
	let files;

	try {files = await fsp.readdir(SEED_PATH);}
	catch (err) {
		if (err.code !== 'ENOENT') console.error('Failed to read the LFT seed folder', err);
		return [];
	}

	const seeds = [];

	for (const file of files.filter(file => file.toLowerCase().endsWith('.png')).sort()) {
		const parsed = parseSeedFileName(file);
		if (!parsed.name) {
			console.warn('Skipping LFT seed with an unusable name:', file);
			continue;
		}
		seeds.push({...parsed, file});
	}

	return seeds;
}


export async function readSeedImage (file) {
	return await fsp.readFile(path.join(SEED_PATH, file));
}


// The next seed to release. LFTs are numbered in order, so whatever number is
// coming up next simply gets claimed by the file named for it, if there is one,
// and otherwise goes to one of the unnumbered pieces at random.
export function pickNextSeed (seeds, nextNumber) {
	const waiting = seeds.filter(seed => !isSeedUsed(seed.file));
	if (!waiting.length) return null;

	const claimed = waiting.find(seed => seed.number === nextNumber);
	if (claimed) return claimed;

	const unnumbered = waiting.filter(seed => seed.number === null);
	if (unnumbered.length) return unnumbered[Math.floor(Math.random() * unnumbered.length)];

	//nothing unnumbered left to fill the gap, so jump ahead to the next
	//numbered one rather than stalling the series on a number nothing claims
	return waiting.sort((a, b) => a.number - b.number)[0];
}


function usedSeeds () {
	return LFT_DATA.get('usedSeeds') || [];
}

export function isSeedUsed (file) {
	return usedSeeds().includes(file);
}

//marked before the auction is posted, so a crash can never release the same
//seed twice
export async function markSeedUsed (file) {
	const used = usedSeeds();
	if (used.includes(file)) return;
	LFT_DATA.set('usedSeeds', [...used, file]);
}

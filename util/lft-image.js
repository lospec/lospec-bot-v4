// Validation and processing for LFT artwork.
//
// An LFT must be a square pixel art png of 8, 16, 32 or 64 pixels using no
// more than 16 colours. It gets scaled up to 64x64 with nearest neighbour so
// it stays crisp as a discord emoji.

import { PNG } from 'pngjs';
import crypto from 'crypto';
import { scalePngData } from './scale-png.js';

export const ALLOWED_SIZES = [8, 16, 32, 64];
export const EMOJI_SIZE = 64;
export const MAX_COLORS = 16;


//"8, 16, 32 or 64"
export function listSizes () {
	return ALLOWED_SIZES.slice(0, -1).join(', ') + ' or ' + ALLOWED_SIZES[ALLOWED_SIZES.length - 1];
}


//reads the png and enforces the LFT art rules, returning the parsed image
export function readAndValidateImage (buffer) {
	let png;
	try {png = PNG.sync.read(buffer);}
	catch (err) {
		console.error('failed to parse LFT png', err);
		throw new Error('That file could not be read as a png image.');
	}

	if (png.width !== png.height)
		throw new Error('LFT artwork must be square, but yours is '+png.width+'x'+png.height+'.');

	if (!ALLOWED_SIZES.includes(png.width))
		throw new Error('LFT artwork must be '+listSizes()+' pixels, but yours is '+png.width+'x'+png.height+'.');

	const colors = countColors(png);
	if (colors > MAX_COLORS)
		throw new Error('LFT artwork can use at most '+MAX_COLORS+' colors, but yours uses '+colors+'. (Fully transparent pixels are free.)');

	return {png, colors};
}


//fully transparent pixels do not count, everything else counts once per rgba
export function countColors (png) {
	const colors = new Set();

	for (let i = 0; i < png.data.length; i += 4) {
		const alpha = png.data[i+3];
		if (alpha === 0) continue;
		colors.add((png.data[i] << 24) | (png.data[i+1] << 16) | (png.data[i+2] << 8) | alpha);
	}

	return colors.size;
}


//scales the art up to the 64x64 png that becomes the emoji
export async function renderEmojiImage (png) {
	if (png.width === EMOJI_SIZE) return PNG.sync.write(png);
	return await scalePngData(png, EMOJI_SIZE / png.width);
}


// Fingerprints the artwork so counterfeits can be detected. The hash is taken
// from the pixels at 64x64 with transparent pixels flattened, so re-uploading
// the same art at a different size or with different colors hidden under full
// transparency still matches the original.
export function hashImage (png) {
	const scale = EMOJI_SIZE / png.width;
	const pixels = Buffer.alloc(EMOJI_SIZE * EMOJI_SIZE * 4);

	for (let y = 0; y < EMOJI_SIZE; y++) {
		for (let x = 0; x < EMOJI_SIZE; x++) {
			const source = (png.width * Math.floor(y/scale) + Math.floor(x/scale)) << 2;
			const target = (EMOJI_SIZE * y + x) << 2;
			const alpha = png.data[source+3];

			pixels[target] = alpha === 0 ? 0 : png.data[source];
			pixels[target+1] = alpha === 0 ? 0 : png.data[source+1];
			pixels[target+2] = alpha === 0 ? 0 : png.data[source+2];
			pixels[target+3] = alpha;
		}
	}

	return crypto.createHash('sha256').update(pixels).digest('hex');
}

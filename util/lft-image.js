// Validation and processing for LFT artwork.
//
// An LFT must be a 128x128 pixel art png using no more than 16 colours. That
// is the size discord stores custom emoji at, so the art is uploaded as it is
// and nothing gets resampled on either end.

import { PNG } from 'pngjs';
import crypto from 'crypto';

export const ART_SIZE = 128;
export const MAX_COLORS = 16;

//the fingerprint is taken at the 64x64 LFTs used to be minted at, so the hashes
//already stored on those still match art that is re-uploaded at 128
export const HASH_SIZE = 64;


//reads the png and enforces the LFT art rules, returning the parsed image
export function readAndValidateImage (buffer) {
	let png;
	try {png = PNG.sync.read(buffer);}
	catch (err) {
		console.error('failed to parse LFT png', err);
		throw new Error('That file could not be read as a png image.');
	}

	if (png.width !== ART_SIZE || png.height !== ART_SIZE)
		throw new Error('LFT artwork must be '+ART_SIZE+'x'+ART_SIZE+' pixels, but yours is '+png.width+'x'+png.height+'.');

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


//re-encodes the art as the png that becomes the emoji, dropping any metadata
export function renderEmojiImage (png) {
	return PNG.sync.write(png);
}


// Fingerprints the artwork so counterfeits can be detected. The hash is taken
// from the pixels sampled down to 64x64 with transparent pixels flattened, so
// re-uploading the same art at a different size or with different colors hidden
// under full transparency still matches the original.
export function hashImage (png) {
	const pixels = Buffer.alloc(HASH_SIZE * HASH_SIZE * 4);

	for (let y = 0; y < HASH_SIZE; y++) {
		for (let x = 0; x < HASH_SIZE; x++) {
			const source = (png.width * Math.floor(y * png.height / HASH_SIZE) + Math.floor(x * png.width / HASH_SIZE)) << 2;
			const target = (HASH_SIZE * y + x) << 2;
			const alpha = png.data[source+3];

			pixels[target] = alpha === 0 ? 0 : png.data[source];
			pixels[target+1] = alpha === 0 ? 0 : png.data[source+1];
			pixels[target+2] = alpha === 0 ? 0 : png.data[source+2];
			pixels[target+3] = alpha;
		}
	}

	return crypto.createHash('sha256').update(pixels).digest('hex');
}

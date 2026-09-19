// Renders the picture of an LFT that gets attached to messages.
//
// Discord does not upscale images in an embed, and it blurs anything it has to
// scale down, so pixel art only stays sharp if it is attached at close to the
// size the client will display it at. The scaled up copy is cached in memory
// because the same LFT gets shown over and over.

import { PNG } from 'pngjs';
import { scalePngData } from './scale-png.js';
import { lftConfig } from './lft.js';

const cache = new Map();
const CACHE_LIMIT = 200;


function previewSize () {
	return Number(lftConfig('previewSize')) || 256;
}


export async function renderPreview (lft) {
	const size = previewSize();
	const key = lft.number + '@' + size;

	if (cache.has(key)) return cache.get(key);

	const buffer = await renderPreviewAtSize(lft, size);

	if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
	cache.set(key, buffer);

	return buffer;
}


//the preview is always a whole multiple of the stored image so the pixels stay
//square. the scale comes from the image itself rather than from ART_SIZE
//because LFTs minted before the move to 128x128 are stored at 64x64
async function renderPreviewAtSize (lft, size) {
	const original = Buffer.from(lft.image, 'base64');
	const source = PNG.sync.read(original);
	const scale = Math.max(1, Math.round(size / source.width));
	if (scale <= 1) return original;
	return await scalePngData(source, scale);
}


export function previewFileName (lft) {
	return 'lft-' + lft.number + '.png';
}

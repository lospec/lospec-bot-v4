// Renders the picture of an LFT that gets attached to messages.
//
// Discord does not upscale images in an embed, and it blurs anything it has to
// scale down, so pixel art only stays sharp if it is attached at close to the
// size the client will display it at. The scaled up copy is cached in memory
// because the same LFT gets shown over and over.

import { PNG } from 'pngjs';
import { scalePngData } from './scale-png.js';
import { lftConfig } from './lft.js';
import { EMOJI_SIZE } from './lft-image.js';

const cache = new Map();
const CACHE_LIMIT = 200;


//the emoji is 64x64, so the preview is always a whole multiple of that
function previewScale () {
	const size = Number(lftConfig('previewSize')) || 256;
	return Math.max(1, Math.round(size / EMOJI_SIZE));
}


export async function renderPreview (lft) {
	const scale = previewScale();
	const key = lft.number + '@' + scale;

	if (cache.has(key)) return cache.get(key);

	const buffer = await renderPreviewAtScale(lft, scale);

	if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
	cache.set(key, buffer);

	return buffer;
}


async function renderPreviewAtScale (lft, scale) {
	const source = PNG.sync.read(Buffer.from(lft.image, 'base64'));
	if (scale <= 1) return Buffer.from(lft.image, 'base64');
	return await scalePngData(source, scale);
}


export function previewFileName (lft) {
	return 'lft-' + lft.number + '.png';
}

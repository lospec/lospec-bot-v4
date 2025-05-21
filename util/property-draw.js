import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const TILE_SIZE = 16;
const TILES_W = 5;
const TILES_H = 4;
const TILE_PATH = path.join('assets', 'property', 'tiles.png');

function getTileCoords(tileIndex) {
	const x = (tileIndex % TILES_W) * TILE_SIZE;
	const y = Math.floor(tileIndex / TILES_W) * TILE_SIZE;
	return {x, y};
}

export async function loadTilesPng() {
	return new Promise((resolve, reject) => {
		fs.createReadStream(TILE_PATH)
			.pipe(new PNG())
			.on('parsed', function () {
				resolve(this);
			})
			.on('error', reject);
	});
}

export function drawHouse(tilesPng, width, height) {
	if (width === 1 && height === 1) {
		return drawHouse1x1(tilesPng);
	}
	if (height === 1) {
		return drawHouse1Tall(tilesPng, width);
	}
	if (width === 1) {
		return drawHouse1Wide(tilesPng, height);
	}
	return drawHouseLarge(tilesPng, width, height);
}

function drawHouse1x1(tilesPng) {
	const out = new PNG({width: TILE_SIZE, height: TILE_SIZE, fill: true});
	copyTile(tilesPng, out, 0, 0, 0);
	return out;
}

function drawHouse1Tall(tilesPng, width) {
	const out = new PNG({width: width * TILE_SIZE, height: TILE_SIZE * 2, fill: true});
	// Extra top row using first row of tiles
	for (let x = 0; x < width; x++) {
		let tileIdx;
		if (x === 0) tileIdx = 1;
		else if (x === width-1) tileIdx = 4;
		else tileIdx = (x % 2 === 0 ? 2 : 3);
		copyTile(tilesPng, out, tileIdx, x, 0);
	}
	// Original row (now second row)
	for (let x = 0; x < width; x++) {
		let tileIdx;
		if (x === 0) tileIdx = 6;
		else if (x === width-1) tileIdx = 9;
		else tileIdx = 8;
		copyTile(tilesPng, out, tileIdx, x, 1);
	}
	const doorX = Math.floor(width/2);
	copyTile(tilesPng, out, 7, doorX, 1);
	return out;
}

function drawHouse1Wide(tilesPng, height) {
	const out = new PNG({width: TILE_SIZE, height: height * TILE_SIZE, fill: true});
	copyTile(tilesPng, out, 5, 5, 0); // top
	for (let y = 1; y < height-1; y++) {
		copyTile(tilesPng, out, 15, 0, y); // middle
	}
	copyTile(tilesPng, out, 20, 0, height-1); // bottom
	return out;
}

function drawHouseLarge(tilesPng, width, height) {
	const out = new PNG({width: width * TILE_SIZE, height: (height + 1) * TILE_SIZE, fill: true});
	// Extra top row using first row of tiles
	for (let x = 0; x < width; x++) {
		let tileIdx;
		if (x === 0) tileIdx = 1;
		else if (x === width-1) tileIdx = 4;
		else tileIdx = (x % 2 === 0 ? 2 : 3);
		copyTile(tilesPng, out, tileIdx, x, 0);
	}
	// Top row (now second row)
	for (let x = 0; x < width; x++) {
		let tileIdx;
		if (x === 0) tileIdx = 11;
		else if (x === width-1) tileIdx = 14;
		else tileIdx = (x % 2 === 0 ? 13 : 12);
		copyTile(tilesPng, out, tileIdx, x, 1);
	}
	// Middle rows
	for (let y = 2; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let tileIdx;
			if (x === 0) tileIdx = 16;
			else if (x === width-1) tileIdx = 19;
			else tileIdx = (x % 2 === 0 ? 18 : 17);
			copyTile(tilesPng, out, tileIdx, x, y);
		}
	}
	// Bottom row
	for (let x = 0; x < width; x++) {
		let tileIdx;
		if (x === 0) tileIdx = 21; // 16+5
		else if (x === width-1) tileIdx = 24; // 19+5
		else if (x === Math.floor(width/2)) tileIdx = 27; // 22+5
		else tileIdx = (x % 2 === 0 ? 23 : 22); // 18+5 : 17+5
		copyTile(tilesPng, out, tileIdx, x, height);
	}
	return out;
}

export async function drawAllPropertiesImage(properties) {
	const users = Object.keys(properties);
	if (users.length === 0) {
		// Return a blank image with just the background
		const blank = new PNG({width: 64, height: 64});
		fillPng(blank, 0x37, 0x9d, 0xd7);
		return PNG.sync.write(blank);
	}
	const tilesPng = await loadTilesPng();
	// Calculate each house's size
	const houseImages = users.map(userId => {
		const {width, height} = properties[userId];
		return drawHouse(tilesPng, width, height);
	});
	const houseWidths = houseImages.map(img => img.width);
	const houseHeights = houseImages.map(img => img.height);
	const marginBetween = 8;
	const marginSide = 16;
	const marginTop = 32;
	const marginBottom = 16;
	const totalWidth = houseWidths.reduce((a, b) => a + b, 0) + marginBetween * (users.length - 1) + marginSide * 2;
	const maxHeight = Math.max(...houseHeights);
	const totalHeight = maxHeight + marginTop + marginBottom;
	const outPng = new PNG({width: totalWidth, height: totalHeight});
	fillPng(outPng, 0x37, 0xa7, 0xdf);
	let xOffset = marginSide;
	for (let i = 0; i < users.length; i++) {
		const house = houseImages[i];
		const yOffset = marginTop + (maxHeight - house.height);
		for (let y = 0; y < house.height; y++) {
			for (let x = 0; x < house.width; x++) {
				const idx = (y * house.width + x) << 2;
				const outIdx = ((y + yOffset) * outPng.width + (x + xOffset)) << 2;
				for (let c = 0; c < 4; c++) {
					outPng.data[outIdx + c] = house.data[idx + c];
				}
			}
		}
		xOffset += house.width + marginBetween;
	}
	return PNG.sync.write(outPng);
}

export function drawSinglePropertyImage(tilesPng, width, height) {
	// Margin and background similar to drawAllPropertiesImage
	const marginSide = 16;
	const marginTop = 32;
	const marginBottom = 16;
	const marginLeft = marginSide;
	const marginRight = marginSide;

	const house = drawHouse(tilesPng, width, height);
	const outWidth = house.width + marginLeft + marginRight;
	const outHeight = house.height + marginTop + marginBottom;
	const outPng = new PNG({width: outWidth, height: outHeight});
	fillPng(outPng, 0x37, 0xa7, 0xdf);

	// Center house horizontally, align to bottom (with margin)
	const xOffset = marginLeft;
	const yOffset = marginTop + (outHeight - marginTop - marginBottom - house.height);
	for (let y = 0; y < house.height; y++) {
		for (let x = 0; x < house.width; x++) {
			const idx = (y * house.width + x) << 2;
			const outIdx = ((y + yOffset) * outPng.width + (x + xOffset)) << 2;
			for (let c = 0; c < 4; c++) {
				outPng.data[outIdx + c] = house.data[idx + c];
			}
		}
	}

	// Draw the ground, using tile 0
	const groundTileIdx = 0;
	const groundTileX = 0;
	const groundTileY = 0;

	for (let y = 0; y < TILE_SIZE; y++) {
		for (let x = 0; x < outWidth; x++) {
			const srcIdx = ((groundTileY + y) * tilesPng.width + (groundTileX + x % TILE_SIZE)) << 2;
			const dstIdx = ((y + outHeight - marginBottom) * outPng.width + (x + xOffset)) << 2;
			for (let c = 0; c < 4; c++) {
				outPng.data[dstIdx + c] = tilesPng.data[srcIdx + c];
			}
		}
	}

	return outPng;
}


function fillPng(png, r, g, b) {
	for (let y = 0; y < png.height; y++) {
		for (let x = 0; x < png.width; x++) {
			const idx = (y * png.width + x) << 2;
			png.data[idx] = r;
			png.data[idx+1] = g;
			png.data[idx+2] = b;
			png.data[idx+3] = 255;
		}
	}
}

function copyTile(tilesPng, outPng, tileIdx, tx, ty) {
	const {x, y} = getTileCoords(tileIdx);
	for (let dy = 0; dy < TILE_SIZE; dy++) {
		for (let dx = 0; dx < TILE_SIZE; dx++) {
			const srcIdx = ((y+dy)*tilesPng.width + (x+dx)) << 2;
			const dstIdx = ((ty*TILE_SIZE+dy)*outPng.width + (tx*TILE_SIZE+dx)) << 2;
			for (let c = 0; c < 4; c++) {
				outPng.data[dstIdx+c] = tilesPng.data[srcIdx+c];
			}
		}
	}
}

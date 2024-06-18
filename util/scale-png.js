import { PNG } from 'pngjs';
import fsp from 'fs/promises';

export async function scalePng (imagePath, scale=4) {
	const currentImage = await fsp.readFile(imagePath);
	const sourcePng = PNG.sync.read(currentImage);
	const targetPng = new PNG({width: sourcePng.width*scale, height: sourcePng.height*scale});

	for (let y = 0; y < sourcePng.height; y++) {
		for (let x = 0; x < sourcePng.width; x++) {
			const idx = (sourcePng.width * y + x) << 2;
			const color = {
				r: sourcePng.data[idx],
				g: sourcePng.data[idx+1],
				b: sourcePng.data[idx+2],
				a: sourcePng.data[idx+3]
			};

			for (let dy = 0; dy < scale; dy++) {
				for (let dx = 0; dx < scale; dx++) {
					const targetIdx = (targetPng.width * (y*scale + dy) + (x*scale + dx)) << 2;
					targetPng.data[targetIdx] = color.r;
					targetPng.data[targetIdx+1] = color.g;
					targetPng.data[targetIdx+2] = color.b;
					targetPng.data[targetIdx+3] = color.a;
				}
			}
		}
	}

	return PNG.sync.write(targetPng);
}
import pngjs from 'pngjs';
import fsp from 'fs/promises';
import path from 'path';
import { scalePngData } from './scale-png.js';

const EMOJI_ARCHIVE_PATH = '_emoji-archive';

export async function generateEmojiHistoryImage(emojiName, history, currentEmojiVersion) {
    if (!history || history.length === 0) return null;

    const arrowBuffer = await fsp.readFile('util/assets/arrow.png');
    let arrowPng = pngjs.PNG.sync.read(arrowBuffer);

    const loadedPngs = [];
    let emojiWidth = 0;
    let emojiHeight = 0;
    const margin = 8;
    const sortedHistory = [...history].sort((a, b) => parseInt(a.version) - parseInt(b.version));

    for (const entry of sortedHistory) {
        let versionPath;
        if (entry.version === currentEmojiVersion) 
            versionPath = path.join(EMOJI_ARCHIVE_PATH, 'current', `${emojiName}.png`);
        else 
            versionPath = path.join(EMOJI_ARCHIVE_PATH, 'old', `${emojiName}_v${entry.version}.png`);
        
        try {
            const fileBuffer = await fsp.readFile(versionPath);
            const png = pngjs.PNG.sync.read(fileBuffer);

            if (loadedPngs.length === 0) {
                emojiWidth = png.width;
                emojiHeight = png.height;
            }

            loadedPngs.push(png);
        } catch (error) {
            console.warn(`Could not load historical emoji image ${versionPath}: ${error.message}`);
        }
    }

    if (loadedPngs.length === 0 || emojiWidth === 0 || emojiHeight === 0) {
        console.log(`No valid historical images found or base dimensions could not be determined for ${emojiName}.`);
        return null; // No valid images to composite or dimensions are zero
    }

    const numVersions = loadedPngs.length;    const arrowWidth = arrowPng.width;
    const arrowHeight = arrowPng.height;
    const compositeWidth = (numVersions * emojiWidth) + ((numVersions + 1) * margin) + ((numVersions - 1) * arrowWidth);
    const compositeHeight = emojiHeight + (2 * margin);
    const compositePng = new pngjs.PNG({ width: compositeWidth, height: compositeHeight });

    // Draw each emoji and arrow onto the composite image
    for (let i = 0; i < loadedPngs.length; i++) {        const srcPng = loadedPngs[i];
        const emojiX = margin + i * (emojiWidth + arrowWidth); 
        const emojiY = margin; 

        pngjs.PNG.bitblt(
            srcPng, compositePng,
            0, 0, emojiWidth, emojiHeight,
            emojiX, emojiY
        );

        // Draw arrow after each emoji except the last one
        if (i < loadedPngs.length - 1) {
            const arrowX = emojiX + emojiWidth; 
            const arrowY = margin; 
            pngjs.PNG.bitblt(
                arrowPng, compositePng,
                0, 0, arrowWidth, arrowHeight,
                arrowX, arrowY
            );
        }
    }

    pngjs.PNG.sync.write(compositePng); 
	return await scalePngData(compositePng, 2);
}
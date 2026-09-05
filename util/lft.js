// Lospec Funky Thingies - the collectable itself.
//
// An LFT is a unique 64x64 pixel art emoji with a unique name and number.
// Users mint them for pikzels, keep them in an inventory, and pass them
// around by auction or by gift.

import { LFT_DATA } from '../data.js';
import * as store from './lft-store.js';
import { readAndValidateImage, renderEmojiImage, hashImage } from './lft-image.js';
import { emojiNameFor, emojiTag, createApplicationEmoji, deleteApplicationEmoji, checkForFreeEmojiSlots } from './lft-emoji.js';

export const CONFIG_DEFAULTS = {
	auctionDurationHours: 96,
	seedIntervalHours: 8,
	seedStartingBid: 1,
	minimumStartingBid: 1,
	//how big the attached picture is - discord blurs anything it has to
	//scale down, so this is worth tuning to whatever renders sharpest
	previewSize: 256,
	//the shape of the emoji grid /lft inventory posts. discord stops drawing
	//emoji big past a certain count, so the page is kept under it - see
	//dev-scripts/lft-emoji-size-test.js
	inventoryColumns: 6,
	inventoryRows: 4,
};

//discord allows 32 characters for an emoji name, and emojiNameFor spends up to
//9 of them on the "lft_0001_" prefix
export const NAME_PATTERN = /^[a-z0-9_]{2,23}$/;

//assert initialises the store, and creates the key blank if it is missing
await LFT_DATA.assert('marketplaceThreadId', false);

for (const [key, value] of Object.entries(CONFIG_DEFAULTS))
	if (LFT_DATA.get(key) === undefined || LFT_DATA.get(key) === '') LFT_DATA.set(key, value);


export function lftConfig (key) {
	const value = LFT_DATA.get(key);
	if (value === undefined || value === '' || value === null) return CONFIG_DEFAULTS[key];
	return value;
}

export function setLftConfig (key, value) {
	LFT_DATA.set(key, value);
}


// ------------------------------------------------------------- naming

//turns whatever the user typed into the canonical lowercase LFT name
export function normalizeName (input) {
	return String(input || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

export function validateName (name) {
	if (!NAME_PATTERN.test(name))
		throw new Error('LFT names must be 2-23 characters, using only letters, numbers and underscores.');
	if (!/[a-z]/.test(name))
		throw new Error('LFT names must contain at least one letter.');
}

//makes a readable title out of a name, for seeds and for anyone who just
//types the slug straight in
export function titleFromName (name) {
	return name.split('_').filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}


// ------------------------------------------------------------ lookups

//accepts "12", "#12" or a name, so users can refer to an LFT however they like
export function findLft (query) {
	const text = String(query || '').trim();
	if (!text) return null;

	const asNumber = text.replace(/^#/, '');
	if (/^\d+$/.test(asNumber)) {
		const byNumber = store.getLftByNumber(asNumber);
		if (byNumber) return byNumber;
	}

	return store.getLftByName(normalizeName(text));
}

export function lftLabel (lft) {
	return emojiTag(lft) + ' **' + lft.title + '** (LFT #' + lft.number + ')';
}

// ------------------------------------------------------------- minting

// Creates the emoji and the LFT record, and gives the first copy to its owner.
// Every check that can reject the LFT runs before anything is created.
export async function mintLft ({name, title, ownerId, creatorId, imageBuffer, origin = 'user', number}) {
	validateName(name);

	if (store.getLftByName(name))
		throw new Error('An LFT called **'+titleFromName(name)+'** already exists. Every LFT needs a unique name.');

	const {png, colors} = readAndValidateImage(imageBuffer);
	const hash = hashImage(png);

	const counterfeit = store.getLftByHash(hash);
	if (counterfeit) throw new Error(counterfeitMessage(counterfeit));

	await checkForFreeEmojiSlots();

	//a seed filename can ask for a particular number, so a curated opening run
	//comes out as #1, #2, #3 rather than in whatever order it happens to mint
	if (number === undefined || number === null) number = store.getNextLftNumber();
	else if (store.getLftByNumber(number))
		throw new Error('LFT #' + number + ' already exists, so this one cannot be minted with that number.');

	const emojiImage = await renderEmojiImage(png);
	const emojiName = emojiNameFor(number, name);
	const emoji = await createApplicationEmoji(emojiName, emojiImage);

	const lft = {
		number,
		name,
		title: title || titleFromName(name),
		hash,
		colors,
		sourceSize: png.width,
		emojiId: emoji.id,
		emojiName,
		creatorId: creatorId || null,
		origin,
		//kept so an LFT can be re-created if its emoji is ever lost
		image: emojiImage.toString('base64'),
		createdAt: new Date().toISOString(),
	};

	try {
		await store.saveLft(lft);
		await store.addToInventory(ownerId, number, 1);
	}
	catch (err) {
		//an emoji with no LFT behind it is one of only 2000 slots wasted
		console.error('Failed to record LFT #'+number+', removing its emoji again', err);
		await deleteApplicationEmoji(emoji.id);
		throw new Error('The LFT could not be saved, so it was not created.');
	}

	console.log('minted LFT #'+number, name, 'for', ownerId);
	return lft;
}


export function counterfeitMessage (original) {
	return 'That artwork is already registered as ' + lftLabel(original) + '.\n\n'
		+ '**Manufacturing counterfeit LFTs is illegal.** Any counterfeits found in circulation will be '
		+ 'confiscated, and their creator will be fined. Consider this your warning.';
}


// ----------------------------------------------------------------- misc

const locks = new Map();

// Runs fn while nothing else holds the same key. Bidding and settling both
// read a balance before writing, and the store must not change underneath
// them while that request is in flight.
export function withLock (key, fn) {
	const previous = locks.get(key) || Promise.resolve();
	const result = previous.then(fn, fn);
	locks.set(key, result.then(() => {}, () => {}));
	return result;
}

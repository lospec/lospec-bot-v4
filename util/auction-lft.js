// LFT auctions - the original kind, and the one everything else was
// generalised out of. See util/auctions.js for what a handler is.
//
// An LFT is held in escrow by taking it out of the seller's inventory, and
// delivered by putting it into the winner's. The treasury also releases a new
// one from the seed folder every few hours, which is what onTick does.

import { AttachmentBuilder } from 'discord.js';
import client from '../client.js';
import { LFT_DATA } from '../data.js';
import * as store from './lft-store.js';
import { lftConfig, lftLabel, mintLft } from './lft.js';
import { emojiTag } from './lft-emoji.js';
import { renderPreview, previewFileName } from './lft-preview.js';
import { createAuction, resolveThread, TREASURY } from './auctions.js';
import { listSeeds, readSeedImage, pickNextSeed, markSeedUsed } from './lft-seed.js';

const MISSING_THREAD = 'The LFT marketplace thread has not been set up yet. An admin needs to set `marketplaceThreadId` in the `lft-data` store.';


//the LFT an auction is for. auctions made before there were other kinds of
//them recorded it as lftNumber, which the store still fills in either way
function lftOf (auction) {
	const lft = store.getLftByNumber(auction.itemId ?? auction.lftNumber);
	if (!lft) throw new Error('That LFT does not exist.');
	return lft;
}


//the treasury holds its own LFTs in an inventory under the bot's own id
export function houseId () {
	return client.user?.id || 'treasury';
}


export default {
	kind: 'lft',
	wonText: 'It is in your inventory now.',

	//lftNumber is kept up to date because it is what the LFT half of the bot
	//looks auctions up by, and what auctions from before all this recorded
	prepare (auction) {
		const lft = lftOf(auction);
		auction.lftNumber = lft.number;

		if (store.getOpenAuctionForItem('lft', lft.number)) throw new Error(lftLabel(lft) + ' is already up for auction.');
	},

	durationHours () {
		return Number(lftConfig('auctionDurationHours'));
	},

	thread () {
		return resolveThread(LFT_DATA.get('marketplaceThreadId'), MISSING_THREAD);
	},

	introText (auction) {
		return auction.sellerId
			? '<@' + auction.sellerId + '> has put an LFT up for auction!'
			: 'A new LFT has been released from the treasury vaults!';
	},

	embedTitle (auction) {
		const lft = lftOf(auction);
		return 'LFT #' + lft.number + ' · ' + lft.title;
	},

	embedDescription (auction) {
		return emojiTag(lftOf(auction)) + ' is up for auction!';
	},

	closedDescription (auction, resultText) {
		return emojiTag(lftOf(auction)) + ' ' + resultText;
	},

	shortName (auction) {
		return lftOf(auction).title;
	},

	itemLabel (auction) {
		return lftLabel(lftOf(auction));
	},

	imageUrl (auction) {
		return 'attachment://' + previewFileName(lftOf(auction));
	},

	async attachments (auction) {
		const lft = lftOf(auction);
		return [new AttachmentBuilder(await renderPreview(lft), {name: previewFileName(lft)})];
	},

	async escrow (auction) {
		await store.removeFromInventory(auction.sellerId || houseId(), lftOf(auction).number, 1);
	},

	async deliver (auction, userId) {
		await store.addToInventory(userId, lftOf(auction).number, 1);
	},

	async restore (auction) {
		await store.addToInventory(auction.sellerId || houseId(), lftOf(auction).number, 1);
	},

	async onTick () {
		await checkSeedSchedule();
	},
};


// -------------------------------------------------------- seed auctions

// Every few hours one of the LFTs from the seed folder is minted and put up for
// auction by the treasury. Each seed file is only ever released once.
export async function runSeedAuction () {
	//LFTs are numbered in order - this is the number about to be handed out,
	//and a seed file named for it gets first claim on it
	const nextNumber = store.getNextLftNumber();
	const seeds = await listSeeds();
	const next = pickNextSeed(seeds, nextNumber);
	if (!next) return console.log('no unreleased LFT seeds left to auction');

	console.log('releasing LFT seed', next.file, 'as #' + (next.number ?? nextNumber));

	let lft = store.getLftByName(next.name);

	//somebody may already own an LFT under this name, in which case the
	//treasury has nothing to sell and the seed is a dud
	if (lft && !store.getInventoryRow(houseId(), lft.number)) {
		console.error('LFT seed', next.file, 'clashes with LFT #' + lft.number + ', which the treasury does not own - skipping it');
		await markSeedUsed(next.file);
		return;
	}

	if (!lft) {
		try {
			lft = await mintLft({
				name: next.name,
				title: next.title,
				ownerId: houseId(),
				creatorId: null,
				imageBuffer: await readSeedImage(next.file),
				origin: 'seed',
				number: next.number ?? nextNumber,
			});
		}
		catch (err) {
			//a seed that cannot be minted (duplicate art, wrong size, a number
			//already taken) must not block the rest of the series, so retire it
			console.error('LFT seed', next.file, 'could not be minted:', err.message);
			await markSeedUsed(next.file);
			return;
		}
	}

	//marked before the auction is posted so a crash cannot release it twice
	await markSeedUsed(next.file);

	return await createAuction({
		kind: 'lft',
		itemId: lft.number,
		sellerId: TREASURY,
		startingBid: Number(lftConfig('seedStartingBid')),
	});
}


function scheduleNextSeedAuction () {
	const hours = Number(lftConfig('seedIntervalHours'));
	LFT_DATA.set('nextSeedAuctionAt', new Date(Date.now() + hours * 60 * 60 * 1000).toISOString());
}


async function checkSeedSchedule () {
	if (!LFT_DATA.get('marketplaceThreadId')) return;

	const due = LFT_DATA.get('nextSeedAuctionAt');

	//first run after the marketplace is set up - start the clock rather than
	//immediately dropping an auction into the channel
	if (!due) return scheduleNextSeedAuction();
	if (new Date(due).getTime() > Date.now()) return;

	//rescheduled before it runs, so a failure cannot retry every single minute
	scheduleNextSeedAuction();

	try {await runSeedAuction();}
	catch (err) {console.error('Seed auction failed', err);}
}

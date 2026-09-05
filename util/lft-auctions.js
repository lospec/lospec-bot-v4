// LFT auctions.
//
// An auction is posted as an embed in the pikzel marketplace thread, collects
// bids for four days, and then pays out. A bid is only checked against the
// bidder's balance when it is made - the winner is charged at the end, and if
// they can no longer pay, the LFT falls to the next highest bidder.

import { AttachmentBuilder } from 'discord.js';
import client from '../client.js';
import { LFT_DATA } from '../data.js';
import * as store from './lft-store.js';
import { lftConfig, lftLabel, withLock, mintLft } from './lft.js';
import { emojiTag } from './lft-emoji.js';
import { renderPreview, previewFileName } from './lft-preview.js';
import { getUserBalance, takeUsersMoney, giveUserMoney } from './lozpekistan-bank.js';
import { listSeeds, readSeedImage, pickNextSeed, markSeedUsed } from './lft-seed.js';

const TICK_INTERVAL = 60 * 1000;
const MAX_SETTLE_ATTEMPTS = 30;
const AUCTION_COLOR = 0xffb300;
const SOLD_COLOR = 0x43b581;
const UNSOLD_COLOR = 0x747f8d;

//an auction with no seller belongs to the treasury - the money paid for it is
//burned rather than going to anybody
export const TREASURY = null;


// -------------------------------------------------------- creating them

export async function createAuction ({lftNumber, sellerId, startingBid}) {
	const lft = store.getLftByNumber(lftNumber);
	if (!lft) throw new Error('That LFT does not exist.');
	if (store.getOpenAuctionForLft(lftNumber)) throw new Error(lftLabel(lft) + ' is already up for auction.');

	const durationHours = Number(lftConfig('auctionDurationHours'));
	const auction = {
		id: nextAuctionId(),
		lftNumber: lft.number,
		sellerId: sellerId || TREASURY,
		startingBid: Math.max(1, Math.floor(Number(startingBid) || 1)),
		bids: [],
		status: 'open',
		settleAttempts: 0,
		createdAt: new Date().toISOString(),
		endsAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
	};

	//the LFT is held in escrow so it cannot be given away mid auction
	await store.removeFromInventory(auction.sellerId || houseId(), lft.number, 1);
	await store.saveAuction(auction);

	try {
		await postAuctionMessage(auction, lft);
	}
	catch (err) {
		//nobody can bid on an auction nobody can see, so undo it
		console.error('Failed to post auction, giving the LFT back', err);
		auction.status = 'cancelled';
		await store.saveAuction(auction);
		await store.addToInventory(auction.sellerId || houseId(), lft.number, 1);
		throw err;
	}

	return auction;
}


function nextAuctionId () {
	const highest = store.getAllAuctions().reduce((max, auction) => Math.max(max, parseInt(auction.id, 10) || 0), 0);
	return String(highest + 1);
}

function houseId () {
	return client.user?.id || 'treasury';
}


// ---------------------------------------------------------- the message

async function getMarketplaceThread () {
	const threadId = LFT_DATA.get('marketplaceThreadId');
	if (!threadId) throw new Error('The LFT marketplace thread has not been set up yet. An admin needs to set `marketplaceThreadId` in the `lft-data` store.');

	const channel = await client.channels.fetch(threadId);
	if (!channel) throw new Error('The LFT marketplace thread could not be found.');

	//an idle thread archives itself, and archived threads reject new messages
	if (channel.isThread?.() && channel.archived) await channel.setArchived(false);

	return channel;
}


async function postAuctionMessage (auction, lft) {
	const thread = await getMarketplaceThread();
	const preview = await renderPreview(lft);

	const message = await thread.send({
		content: auction.sellerId
			? '<@' + auction.sellerId + '> has put an LFT up for auction!'
			: 'A new LFT has been released from the treasury vaults!',
		embeds: [auctionEmbed(auction, lft)],
		files: [new AttachmentBuilder(preview, {name: previewFileName(lft)})],
		components: [bidActionRow(auction)],
	});

	auction.channelId = message.channel.id;
	auction.messageId = message.id;
	await store.saveAuction(auction);

	return message;
}


function bidActionRow (auction) {
	return {
		type: 1,
		components: [{
			type: 2,
			style: 1,
			label: 'Place Bid',
			customId: 'lft_bid_' + auction.id,
		}],
	};
}


function auctionEmbed (auction, lft) {
	const highest = highestBid(auction);
	const endsAt = Math.floor(new Date(auction.endsAt).getTime() / 1000);

	return {
		title: 'LFT #' + lft.number + ' · ' + lft.title,
		description: emojiTag(lft) + ' is up for auction!',
		color: AUCTION_COLOR,
		image: {url: 'attachment://' + previewFileName(lft)},
		fields: [
			{
				name: highest ? 'Current Bid' : 'Starting Bid',
				value: (highest ? highest.amount : auction.startingBid) + 'P',
				inline: true,
			},
			{
				name: 'Highest Bidder',
				value: highest ? '<@' + highest.userId + '>' : 'nobody yet',
				inline: true,
			},
			{
				name: 'Ends',
				value: '<t:' + endsAt + ':R>',
				inline: true,
			},
			{
				name: 'Seller',
				value: auction.sellerId ? '<@' + auction.sellerId + '>' : 'The Lozpekistan Treasury',
				inline: true,
			},
			{
				name: 'Bids',
				value: String(auction.bids.length),
				inline: true,
			},
		],
		footer: {text: 'Auction #' + auction.id + ' · bid with the button below'},
	};
}


async function updateAuctionMessage (auction) {
	if (!auction.messageId) return;
	const lft = store.getLftByNumber(auction.lftNumber);

	try {
		const channel = await client.channels.fetch(auction.channelId);
		const message = await channel.messages.fetch(auction.messageId);
		//the picture is left alone, editing only the embed keeps the attachment
		await message.edit({embeds: [auctionEmbed(auction, lft)], components: [bidActionRow(auction)]});
	}
	catch (err) {
		console.error('Failed to update the message for auction', auction.id, err);
	}
}


async function closeAuctionMessage (auction, resultText, color) {
	if (!auction.messageId) return;
	const lft = store.getLftByNumber(auction.lftNumber);

	try {
		const channel = await client.channels.fetch(auction.channelId);
		const message = await channel.messages.fetch(auction.messageId);
		const embed = auctionEmbed(auction, lft);

		embed.color = color;
		embed.description = emojiTag(lft) + ' ' + resultText;
		embed.fields = embed.fields.filter(field => field.name !== 'Ends');
		embed.footer = {text: 'Auction #' + auction.id + ' · closed'};

		await message.edit({embeds: [embed], components: []});
		await message.reply({content: resultText});
	}
	catch (err) {
		console.error('Failed to close the message for auction', auction.id, err);
	}
}


// -------------------------------------------------------------- bidding

export function highestBid (auction) {
	return auction.bids.reduce((best, bid) => (!best || bid.amount > best.amount ? bid : best), null);
}

export function minimumBid (auction) {
	const highest = highestBid(auction);
	return highest ? highest.amount + 1 : auction.startingBid;
}


// Places a bid, re-checking everything under a lock - two people clicking the
// bid button at once must not both end up as the highest bidder.
export async function placeBid (auctionId, userId, amount) {
	return withLock('auction-' + auctionId, async () => {
		const auction = store.getAuction(auctionId);
		if (!auction) throw new Error('That auction does not exist.');
		if (auction.status !== 'open') throw new Error('That auction has already ended.');
		if (new Date(auction.endsAt).getTime() <= Date.now()) throw new Error('That auction has already ended.');
		if (auction.sellerId === userId) throw new Error('You cannot bid on your own auction.');

		amount = Math.floor(Number(amount));
		if (!Number.isFinite(amount) || amount <= 0) throw new Error('Your bid must be a whole number of pikzels.');

		const minimum = minimumBid(auction);
		if (amount < minimum) throw new Error('The bid to beat is ' + minimum + 'P.');

		const highest = highestBid(auction);
		if (highest && highest.userId === userId) throw new Error('You are already the highest bidder.');

		let balance;
		try {balance = await getUserBalance(userId);}
		catch (err) {throw new Error('The bank is not answering right now, so your bid could not be checked. Try again in a moment.');}

		if (typeof balance !== 'number') throw new Error('The bank could not tell us your balance, so your bid could not be placed.');
		if (balance < amount) throw new Error('You only have ' + balance + 'P, so you cannot bid ' + amount + 'P.');

		//the auction may have moved on while the bank was being asked
		if (auction.status !== 'open') throw new Error('That auction has already ended.');
		if (amount < minimumBid(auction)) throw new Error('Somebody outbid you while that was being checked - the bid to beat is now ' + minimumBid(auction) + 'P.');

		const outbid = highestBid(auction);
		auction.bids.push({userId, amount, at: new Date().toISOString()});
		await store.saveAuction(auction);

		await updateAuctionMessage(auction);
		if (outbid && outbid.userId !== userId) notifyOutbid(auction, outbid, amount);

		return auction;
	});
}


async function notifyOutbid (auction, outbid, amount) {
	const lft = store.getLftByNumber(auction.lftNumber);

	await dm(outbid.userId, {
		embeds: [{
			title: 'You have been outbid',
			description: 'Somebody bid **' + amount + 'P** on ' + lftLabel(lft) + ', beating your ' + outbid.amount + 'P bid.',
			color: AUCTION_COLOR,
			footer: {text: 'Auction #' + auction.id},
		}],
	});
}


// ----------------------------------------------------------- settlement

// The bids ranked highest first, one entry per bidder, ties going to whoever
// got there first.
export function rankedBidders (auction) {
	const best = new Map();

	for (const bid of auction.bids) {
		const existing = best.get(bid.userId);
		if (!existing || bid.amount > existing.amount) best.set(bid.userId, bid);
	}

	return [...best.values()].sort((a, b) => b.amount - a.amount || new Date(a.at) - new Date(b.at));
}


// Takes money off a user, telling the difference between "they cannot afford
// it" and "the bank is broken" - only the first should cost them the win.
async function chargeUser (userId, amount) {
	let before;

	try {before = await getUserBalance(userId);}
	catch (err) {return 'error';}

	if (typeof before !== 'number') return 'error';
	if (before < amount) return 'insufficient';

	try {
		await takeUsersMoney(userId, amount);
		return 'paid';
	}
	catch (err) {
		console.error('Charge failed for', userId, err);
		//the withdrawal may have gone through before the error came back, so
		//check the balance rather than risk charging them twice
		try {
			const after = await getUserBalance(userId);
			if (typeof after === 'number' && after <= before - amount) return 'paid';
		}
		catch (checkErr) {console.error('Could not check the balance after a failed charge', checkErr);}

		return 'error';
	}
}


export async function settleAuction (auctionId) {
	return withLock('auction-' + auctionId, async () => {
		const auction = store.getAuction(auctionId);
		if (!auction || auction.status !== 'open') return;

		const lft = store.getLftByNumber(auction.lftNumber);
		const candidates = rankedBidders(auction);
		const brokeBidders = [];

		for (const bid of candidates) {
			const result = await chargeUser(bid.userId, bid.amount);

			if (result === 'error') {
				//the bank is unreachable, so leave the auction open and run the
				//whole payout again on the next tick
				auction.settleAttempts = (auction.settleAttempts || 0) + 1;
				await store.saveAuction(auction);

				if (auction.settleAttempts < MAX_SETTLE_ATTEMPTS) {
					console.warn('Auction', auction.id, 'could not be settled, attempt', auction.settleAttempts);
					return;
				}

				console.error('Auction', auction.id, 'gave up settling after', auction.settleAttempts, 'attempts');
				break;
			}

			if (result === 'insufficient') {
				brokeBidders.push(bid);
				continue;
			}

			return await finishSale(auction, lft, bid, brokeBidders);
		}

		return await finishWithoutSale(auction, lft, brokeBidders);
	});
}


async function finishSale (auction, lft, bid, brokeBidders) {
	auction.status = 'sold';
	auction.winnerId = bid.userId;
	auction.winningBid = bid.amount;
	auction.settledAt = new Date().toISOString();
	await store.saveAuction(auction);

	await store.addToInventory(bid.userId, lft.number, 1);

	if (auction.sellerId) await paySeller(auction, lft, bid);
	else console.log('burned', bid.amount, 'P from treasury auction', auction.id);

	await closeAuctionMessage(auction, 'Sold to <@' + bid.userId + '> for **' + bid.amount + 'P**!', SOLD_COLOR);

	await dm(bid.userId, {
		embeds: [{
			title: 'You won an auction!',
			description: 'You won ' + lftLabel(lft) + ' for **' + bid.amount + 'P**. It is in your inventory now.',
			color: SOLD_COLOR,
			footer: {text: 'Auction #' + auction.id},
		}],
	});

	for (const loser of brokeBidders) await notifyFailedToPay(auction, lft, loser);

	console.log('auction', auction.id, 'sold LFT #' + lft.number, 'to', bid.userId, 'for', bid.amount);
	return auction;
}


async function paySeller (auction, lft, bid) {
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			await giveUserMoney(auction.sellerId, bid.amount);
			auction.sellerPaid = true;
			await store.saveAuction(auction);

			await dm(auction.sellerId, {
				embeds: [{
					title: 'Your LFT sold!',
					description: lftLabel(lft) + ' sold to <@' + bid.userId + '> for **' + bid.amount + 'P**, which has been paid into your account.',
					color: SOLD_COLOR,
					footer: {text: 'Auction #' + auction.id},
				}],
			});
			return;
		}
		catch (err) {
			console.error('Failed to pay the seller of auction', auction.id, 'attempt', attempt, err);
		}
	}

	auction.sellerPaid = false;
	await store.saveAuction(auction);

	await dm(auction.sellerId, {
		content: 'Your LFT ' + lftLabel(lft) + ' sold for **' + bid.amount + 'P**, but the bank would not accept the payment. '
			+ 'Please show a moderator this message and quote auction #' + auction.id + '.',
	});
}


async function finishWithoutSale (auction, lft, brokeBidders) {
	auction.status = 'unsold';
	auction.settledAt = new Date().toISOString();
	await store.saveAuction(auction);

	//the escrowed copy goes back where it came from
	await store.addToInventory(auction.sellerId || houseId(), lft.number, 1);

	const home = auction.sellerId ? 'its owner' : 'the treasury';
	const reason = auction.bids.length === 0
		? 'No bids - returned to ' + home + '.'
		: 'Nobody who bid could pay up, so it goes back to ' + home + '.';

	await closeAuctionMessage(auction, reason, UNSOLD_COLOR);

	if (auction.sellerId) await dm(auction.sellerId, {
		embeds: [{
			title: 'Your auction ended',
			description: lftLabel(lft) + ' did not sell. ' + reason + ' You can put it up again whenever you like.',
			color: UNSOLD_COLOR,
			footer: {text: 'Auction #' + auction.id},
		}],
	});

	for (const loser of brokeBidders) await notifyFailedToPay(auction, lft, loser);

	return auction;
}


async function notifyFailedToPay (auction, lft, bid) {
	await dm(bid.userId, {
		embeds: [{
			title: 'You could not pay for the auction you won',
			description: 'Your ' + bid.amount + 'P bid on ' + lftLabel(lft) + ' was the highest, but you did not have '
				+ bid.amount + 'P when the auction closed, so it went to the next bidder instead. Do not bid what you cannot pay!',
			color: UNSOLD_COLOR,
			footer: {text: 'Auction #' + auction.id},
		}],
	});
}


async function dm (userId, message) {
	try {
		const user = await client.users.fetch(userId);
		await user.send(message);
	}
	catch (err) {
		console.warn('Could not DM user', userId, '-', err.message);
	}
}


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
		lftNumber: lft.number,
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


// ----------------------------------------------------------------- tick

async function tick () {
	try {
		for (const auction of store.getOpenAuctions()) {
			if (new Date(auction.endsAt).getTime() > Date.now()) continue;
			console.log('settling auction', auction.id);
			await settleAuction(auction.id);
		}
	}
	catch (err) {console.error('Auction tick failed', err);}

	try {await checkSeedSchedule();}
	catch (err) {console.error('Seed schedule check failed', err);}
}


function startTicking () {
	console.log('LFT auctions running -', store.getOpenAuctions().length, 'open auctions');
	//catches up on anything that ended while the bot was offline
	tick();
	setInterval(tick, TICK_INTERVAL);
}

//commands are loaded from inside the ready handler, so by the time this module
//is imported the ready event has usually already been and gone
if (client.isReady?.()) startTicking();
else client.once('ready', startTicking);


// ------------------------------------------------- bidding from the embed

client.on('interactionCreate', async interaction => {
	try {
		if (interaction.isButton?.() && interaction.customId.startsWith('lft_bid_')) await openBidModal(interaction);
		else if (interaction.isModalSubmit?.() && interaction.customId.startsWith('lft_bid_modal_')) await submitBidModal(interaction);
	}
	catch (err) {
		console.error('LFT bid interaction failed', err);
	}
});


async function openBidModal (interaction) {
	const auction = store.getAuction(interaction.customId.replace('lft_bid_', ''));

	if (!auction || auction.status !== 'open')
		return interaction.reply({content: 'That auction has already ended.', ephemeral: true});

	if (auction.sellerId === interaction.user.id)
		return interaction.reply({content: 'You cannot bid on your own auction.', ephemeral: true});

	const lft = store.getLftByNumber(auction.lftNumber);

	await interaction.showModal({
		customId: 'lft_bid_modal_' + auction.id,
		title: ('Bid on ' + lft.title).slice(0, 45),
		components: [{
			type: 1,
			components: [{
				type: 4,
				customId: 'amount',
				label: 'Your bid in pikzels',
				style: 1,
				placeholder: 'at least ' + minimumBid(auction) + 'P',
				required: true,
				maxLength: 10,
			}],
		}],
	});
}


async function submitBidModal (interaction) {
	const auctionId = interaction.customId.replace('lft_bid_modal_', '');
	const amount = interaction.fields.getTextInputValue('amount').replace(/[^0-9]/g, '');

	await interaction.deferReply({ephemeral: true});

	try {
		const auction = await placeBid(auctionId, interaction.user.id, amount);
		const lft = store.getLftByNumber(auction.lftNumber);
		await interaction.editReply({content: 'Your bid of **' + Number(amount) + 'P** on ' + lftLabel(lft) + ' is in. You only pay if you win.'});
	}
	catch (err) {
		await interaction.editReply({content: 'Bid rejected. ' + err.message});
	}
}

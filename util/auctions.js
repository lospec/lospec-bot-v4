// Auctions.
//
// An auction is posted as an embed in a thread, collects bids for a few days,
// and then pays out. A bid is only checked against the bidder's balance when it
// is made - the winner is charged at the end, and if they can no longer pay,
// the item falls to the next highest bidder.
//
// What is being sold is the only part that differs, and that lives in a handler
// module per kind of auction - see TYPE_MODULES below, and the contract they
// implement. Everything in here is the same whatever is on the block: the
// bidding, the message, the money and the timers.

import client from '../client.js';
import * as store from './lft-store.js';
import { withLock } from './lock.js';
import { getUserBalance, takeUsersMoney, giveUserMoney } from './lozpekistan-bank.js';

const TICK_INTERVAL = 60 * 1000;
const MAX_SETTLE_ATTEMPTS = 30;

export const AUCTION_COLOR = 0xffb300;
export const SOLD_COLOR = 0x43b581;
export const UNSOLD_COLOR = 0x747f8d;

//an auction with no seller belongs to the treasury - the money paid for it is
//burned rather than going to anybody
export const TREASURY = null;

export const TREASURY_NAME = 'The Lozpekistan Treasury';


// ------------------------------------------------------ the kinds of them

// Every kind of thing that can go under the hammer, and the module that knows
// how to hold, describe and hand one over.
//
// A handler is the default export of its module, and may implement:
//
//   kind                     the key it is listed under here
//   prepare(auction)         fill in and check kind specific details, before
//                            anything is created. throw to refuse the auction
//   durationHours(auction)   how long bidding runs for
//   thread(auction)          the channel to post in
//   introText(auction)       the line of text above the embed
//   embedTitle(auction)      the heading on the auction post
//   embedDescription(a)      the line under it
//   closedDescription(a, t)  what that becomes once the auction has ended
//   shortName(auction)       a few words, for the bid dialog
//   itemLabel(auction)       how the thing reads inline, in DMs and replies
//   extraFields(auction)     any further embed fields
//   attachments(auction)     files to send with the first message
//   imageUrl(auction)        the embed image, on edits as well as the first post
//   color(auction)           the embed colour while bidding is open
//   wonText                  what the winner is told about collecting it
//   escrow(auction)          take the thing off the seller. throw to refuse
//   deliver(auction, userId) hand it to the winner. throw and they are refunded
//   restore(auction)         give it back, when it does not sell
//   canBid(auction, userId)  a reason this person may not bid, or nothing
//   canReceive(a, userId)    a reason this person cannot be given it, or nothing
//   onSold(auction, bid)     anything to do after a successful sale
//   onTick()                 anything the kind needs doing periodically
//
// They are imported on demand so that a handler can import this module straight
// back without the two of them deadlocking on each other at load.
const TYPE_MODULES = {
	lft: './auction-lft.js',
	role: './auction-role.js',
	custom: './auction-custom.js',
};

export const AUCTION_KINDS = Object.keys(TYPE_MODULES);

const handlers = new Map();

export async function getHandler (kind) {
	kind = kind || 'lft';
	if (handlers.has(kind)) return handlers.get(kind);

	const path = TYPE_MODULES[kind];
	if (!path) throw new Error('There is no such kind of auction as "' + kind + '".');

	const handler = (await import(path)).default;
	handlers.set(kind, handler);

	return handler;
}


// -------------------------------------------------------- creating them

export async function createAuction ({kind = 'lft', itemId = null, sellerId = TREASURY, startingBid, ...details}) {
	const handler = await getHandler(kind);

	//ids are handed out in order, and two auctions started at the same moment
	//must not be given the same one
	return withLock('auction-create', async () => {
		const auction = {
			id: nextAuctionId(),
			kind,
			itemId: itemId === null || itemId === undefined ? null : String(itemId),
			sellerId: sellerId || TREASURY,
			startingBid: Math.max(1, Math.floor(Number(startingBid) || 1)),
			bids: [],
			status: 'open',
			settleAttempts: 0,
			createdAt: new Date().toISOString(),
			...details,
		};

		//the handler fills in and checks its own details, and may refuse the
		//whole thing, before anything has been created or moved
		await handler.prepare?.(auction);

		const durationHours = Number(await handler.durationHours(auction));
		auction.endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

		//the item is held in escrow so it cannot be given away mid auction
		await handler.escrow(auction);
		await store.saveAuction(auction);

		try {
			await postAuctionMessage(auction, handler);
		}
		catch (err) {
			//nobody can bid on an auction nobody can see, so undo it
			console.error('Failed to post auction, giving the item back', err);
			auction.status = 'cancelled';
			await store.saveAuction(auction);
			try {await handler.restore(auction);}
			catch (restoreErr) {console.error('Could not give back the item from auction', auction.id, restoreErr);}
			throw err;
		}

		console.log('opened', kind, 'auction', auction.id, 'for', auction.itemId, 'by', auction.sellerId || 'the treasury');
		return auction;
	});
}


function nextAuctionId () {
	const highest = store.getAllAuctions().reduce((max, auction) => Math.max(max, parseInt(auction.id, 10) || 0), 0);
	return String(highest + 1);
}


// ---------------------------------------------------------- the message

// Fetches a thread the auctions get posted in, saying which setting is missing
// rather than throwing something nobody can act on.
export async function resolveThread (threadId, missing) {
	if (!threadId) throw new Error(missing);

	const channel = await client.channels.fetch(String(threadId));
	if (!channel) throw new Error(missing);

	//an idle thread archives itself, and archived threads reject new messages
	if (channel.isThread?.() && channel.archived) await channel.setArchived(false);

	return channel;
}


async function postAuctionMessage (auction, handler) {
	const thread = await handler.thread(auction);
	const files = (await handler.attachments?.(auction)) || [];

	const message = await thread.send({
		content: await handler.introText(auction),
		embeds: [await auctionEmbed(auction, handler)],
		files,
		components: [bidActionRow(auction)],
	});

	auction.channelId = message.channel.id;
	auction.messageId = message.id;
	auction.guildId = message.guild?.id || auction.guildId || null;
	await store.saveAuction(auction);

	return message;
}


//an auction cannot be called off once it is up. there is nothing else to press
function bidActionRow (auction) {
	return {
		type: 1,
		components: [{
			type: 2,
			style: 1,
			label: 'Place Bid',
			customId: 'auction_bid_' + auction.id,
		}],
	};
}


async function auctionEmbed (auction, handler) {
	const highest = highestBid(auction);
	const endsAt = Math.floor(new Date(auction.endsAt).getTime() / 1000);

	const fields = [
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
			value: auction.sellerId ? '<@' + auction.sellerId + '>' : TREASURY_NAME,
			inline: true,
		},
		{
			name: 'Bids',
			value: String(auction.bids.length),
			inline: true,
		},
		...(await handler.extraFields?.(auction) || []),
	];

	const embed = {
		title: await handler.embedTitle(auction),
		description: await handler.embedDescription(auction),
		color: (await handler.color?.(auction)) || AUCTION_COLOR,
		fields,
		footer: {text: 'Auction #' + auction.id + ' · bid with the button below'},
	};

	const image = await handler.imageUrl?.(auction);
	if (image) embed.image = {url: image};

	return embed;
}


async function updateAuctionMessage (auction, handler) {
	if (!auction.messageId) return;

	try {
		const channel = await client.channels.fetch(auction.channelId);
		const message = await channel.messages.fetch(auction.messageId);
		//the picture is left alone, editing only the embed keeps the attachment
		await message.edit({embeds: [await auctionEmbed(auction, handler)], components: [bidActionRow(auction)]});
	}
	catch (err) {
		console.error('Failed to update the message for auction', auction.id, err);
	}
}


async function closeAuctionMessage (auction, handler, resultText, color) {
	if (!auction.messageId) return;

	try {
		const channel = await client.channels.fetch(auction.channelId);
		const message = await channel.messages.fetch(auction.messageId);
		const embed = await auctionEmbed(auction, handler);

		embed.color = color;
		embed.description = (await handler.closedDescription?.(auction, resultText)) || resultText;
		embed.fields = embed.fields.filter(field => field.name !== 'Ends');
		embed.footer = {text: 'Auction #' + auction.id + ' · closed'};

		await message.edit({embeds: [embed], components: []});
		await message.reply({content: resultText});
	}
	catch (err) {
		console.error('Failed to close the message for auction', auction.id, err);
	}
}


//a jump link to the auction post, for replies that want to point at it
export function auctionLink (auction, guildId) {
	if (!auction.channelId || !auction.messageId) return '';
	return 'https://discord.com/channels/' + (auction.guildId || guildId || '@me') + '/' + auction.channelId + '/' + auction.messageId;
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

		const handler = await getHandler(auction.kind);

		const refused = await handler.canBid?.(auction, userId);
		if (refused) throw new Error(refused);

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

		await updateAuctionMessage(auction, handler);
		if (outbid && outbid.userId !== userId) notifyOutbid(auction, handler, outbid, amount);

		return auction;
	});
}


async function notifyOutbid (auction, handler, outbid, amount) {
	await dm(outbid.userId, {
		embeds: [{
			title: 'You have been outbid',
			description: 'Somebody bid **' + amount + 'P** on ' + await handler.itemLabel(auction) + ', beating your ' + outbid.amount + 'P bid.',
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

		const handler = await getHandler(auction.kind);
		const candidates = rankedBidders(auction);
		const passedOver = [];

		for (const bid of candidates) {
			//somebody who cannot be given the thing any more - a role bidder who
			//has since left the server - is passed over like one who cannot pay
			let refused = null;
			try {refused = await handler.canReceive?.(auction, bid.userId);}
			catch (err) {refused = err.message;}

			if (refused) {
				console.log('auction', auction.id, 'passing over', bid.userId, '-', refused);
				passedOver.push({...bid, reason: refused});
				continue;
			}

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
				passedOver.push(bid);
				continue;
			}

			//the sale is written down the moment the money is taken, and before
			//anything slower happens. a crash in the gap between those two is
			//what would have the next tick charge the same person all over again
			auction.status = 'sold';
			auction.winnerId = bid.userId;
			auction.winningBid = bid.amount;
			auction.settledAt = new Date().toISOString();
			await store.saveAuction(auction);

			//it is paid for - if it cannot be handed over now, that is the bot's
			//problem rather than the winner's, so they get their money back
			try {
				await handler.deliver(auction, bid.userId);
			}
			catch (err) {
				console.error('Auction', auction.id, 'could not be delivered to', bid.userId, err);
				await refund(auction, handler, bid);

				auction.winnerId = null;
				auction.winningBid = null;
				auction.deliveryFailed = {userId: bid.userId, amount: bid.amount, at: new Date().toISOString()};

				return await finishWithoutSale(auction, handler, passedOver, 'It could not be handed over, so nothing was sold and the winning bid was refunded.');
			}

			return await finishSale(auction, handler, bid, passedOver);
		}

		return await finishWithoutSale(auction, handler, passedOver);
	});
}


async function refund (auction, handler, bid) {
	const label = await handler.itemLabel(auction);

	try {
		await giveUserMoney(bid.userId, bid.amount);
		await dm(bid.userId, {
			content: 'Your winning bid of **' + bid.amount + 'P** on ' + label
				+ ' has been refunded, because it could not be handed over to you. Sorry about that.',
		});
	}
	catch (err) {
		console.error('REFUND FAILED for auction', auction.id, '-', bid.userId, 'is owed', bid.amount, err);
		await dm(bid.userId, {
			content: 'You were charged **' + bid.amount + 'P** for ' + label + ', which could not be handed over, '
				+ 'and the refund failed as well. Please show a moderator this message and quote auction #' + auction.id + '.',
		});
	}
}


//everything that happens after the sale itself has been recorded and the item
//handed over: paying up, closing the post, and telling everybody
async function finishSale (auction, handler, bid, passedOver) {
	const label = await handler.itemLabel(auction);

	if (auction.sellerId) await paySeller(auction, label, bid);
	else console.log('burned', bid.amount, 'P from treasury auction', auction.id);

	await closeAuctionMessage(auction, handler, 'Sold to <@' + bid.userId + '> for **' + bid.amount + 'P**!', SOLD_COLOR);

	await dm(bid.userId, {
		embeds: [{
			title: 'You won an auction!',
			description: 'You won ' + label + ' for **' + bid.amount + 'P**. ' + (handler.wonText || 'It is yours now.'),
			color: SOLD_COLOR,
			footer: {text: 'Auction #' + auction.id},
		}],
	});

	for (const loser of passedOver) await notifyLosingBidder(auction, label, loser);

	try {await handler.onSold?.(auction, bid);}
	catch (err) {console.error('Tidying up after auction', auction.id, 'failed', err);}

	console.log('auction', auction.id, 'sold', auction.kind, auction.itemId, 'to', bid.userId, 'for', bid.amount);
	return auction;
}


async function paySeller (auction, label, bid) {
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			await giveUserMoney(auction.sellerId, bid.amount);
			auction.sellerPaid = true;
			await store.saveAuction(auction);

			await dm(auction.sellerId, {
				embeds: [{
					title: 'Your auction sold!',
					description: label + ' sold to <@' + bid.userId + '> for **' + bid.amount + 'P**, which has been paid into your account.',
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
		content: 'Your ' + label + ' sold for **' + bid.amount + 'P**, but the bank would not accept the payment. '
			+ 'Please show a moderator this message and quote auction #' + auction.id + '.',
	});
}


async function finishWithoutSale (auction, handler, passedOver, because) {
	auction.status = 'unsold';
	auction.settledAt = new Date().toISOString();
	await store.saveAuction(auction);

	//the escrowed item goes back where it came from
	try {await handler.restore(auction);}
	catch (err) {console.error('Could not give back the item from auction', auction.id, err);}

	const label = await handler.itemLabel(auction);
	const home = auction.sellerId ? 'its owner' : 'the treasury';
	const reason = because || (auction.bids.length === 0
		? 'No bids - returned to ' + home + '.'
		: 'Nobody who bid could pay up, so it goes back to ' + home + '.');

	await closeAuctionMessage(auction, handler, reason, UNSOLD_COLOR);

	if (auction.sellerId) await dm(auction.sellerId, {
		embeds: [{
			title: 'Your auction ended',
			description: label + ' did not sell. ' + reason + ' You can put it up again whenever you like.',
			color: UNSOLD_COLOR,
			footer: {text: 'Auction #' + auction.id},
		}],
	});

	for (const loser of passedOver) await notifyLosingBidder(auction, label, loser);

	return auction;
}


async function notifyLosingBidder (auction, label, bid) {
	await dm(bid.userId, {
		embeds: [{
			title: 'You did not get what you bid on',
			description: bid.reason
				? 'Your ' + bid.amount + 'P bid on ' + label + ' was passed over: ' + bid.reason
				: 'Your ' + bid.amount + 'P bid on ' + label + ' was the highest, but you did not have '
					+ bid.amount + 'P when the auction closed, so it went to the next bidder instead. Do not bid what you cannot pay!',
			color: UNSOLD_COLOR,
			footer: {text: 'Auction #' + auction.id},
		}],
	});
}


export async function dm (userId, message) {
	try {
		const user = await client.users.fetch(userId);
		await user.send(message);
	}
	catch (err) {
		console.warn('Could not DM user', userId, '-', err.message);
	}
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

	//every kind gets a look in whether it has anything running or not - this is
	//what releases new LFTs and notices abandoned roles, and it is also what
	//makes sure every handler is loaded and listening
	for (const kind of AUCTION_KINDS) {
		try {
			const handler = await getHandler(kind);
			await handler.onTick?.();
		}
		catch (err) {console.error('The', kind, 'auction tick failed', err);}
	}
}


function startTicking () {
	console.log('Auctions running -', store.getOpenAuctions().length, 'open auctions');
	//catches up on anything that ended while the bot was offline
	tick();
	setInterval(tick, TICK_INTERVAL);
}

//commands are loaded from inside the ready handler, so by the time this module
//is imported the ready event has usually already been and gone
if (client.isReady?.()) startTicking();
else client.once('ready', startTicking);


// ------------------------------------------------- bidding from the embed

//auctions posted before there was more than one kind of them have buttons that
//say lft_bid_, and those messages are still out there collecting bids
const BID_BUTTON = /^(?:auction|lft)_bid_(\d+)$/;
const BID_MODAL = /^(?:auction|lft)_bid_modal_(\d+)$/;

client.on('interactionCreate', async interaction => {
	try {
		if (interaction.isButton?.() && BID_BUTTON.test(interaction.customId)) await openBidModal(interaction);
		else if (interaction.isModalSubmit?.() && BID_MODAL.test(interaction.customId)) await submitBidModal(interaction);
	}
	catch (err) {
		console.error('Auction bid interaction failed', err);
	}
});



async function openBidModal (interaction) {
	const auction = store.getAuction(interaction.customId.match(BID_BUTTON)[1]);

	if (!auction || auction.status !== 'open')
		return interaction.reply({content: 'That auction has already ended.', ephemeral: true});

	if (auction.sellerId === interaction.user.id)
		return interaction.reply({content: 'You cannot bid on your own auction.', ephemeral: true});

	const handler = await getHandler(auction.kind);

	const refused = await handler.canBid?.(auction, interaction.user.id);
	if (refused) return interaction.reply({content: refused, ephemeral: true});

	await interaction.showModal({
		customId: 'auction_bid_modal_' + auction.id,
		title: ('Bid on ' + await handler.shortName(auction)).slice(0, 45),
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
	const auctionId = interaction.customId.match(BID_MODAL)[1];
	const amount = interaction.fields.getTextInputValue('amount').replace(/[^0-9]/g, '');

	await interaction.deferReply({ephemeral: true});

	try {
		const auction = await placeBid(auctionId, interaction.user.id, amount);
		const handler = await getHandler(auction.kind);
		await interaction.editReply({content: 'Your bid of **' + Number(amount) + 'P** on ' + await handler.itemLabel(auction) + ' is in. You only pay if you win.'});
	}
	catch (err) {
		await interaction.editReply({content: 'Bid rejected. ' + err.message});
	}
}

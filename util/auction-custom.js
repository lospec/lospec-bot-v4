// User run auctions.
//
// Anybody can auction anything they like - art, commissions, a favour - from a
// thread they started in the auction forum. The bot only handles the money: it
// takes the bids, charges the winner and pays the seller. Handing over whatever
// was actually sold is between the two of them.
//
// Because of that there is nothing to hold in escrow, and nothing to give back
// if it does not sell.

import client from '../client.js';
import * as store from './lft-store.js';
import { auctionConfig, configuredIds } from './auction-config.js';
import { resolveThread } from './auctions.js';

const MISSING_FORUM = 'The auction forum has not been set up yet. An admin needs to set `customAuctionForumId` in the `auction-data` store.';


//the forums a user may run an auction in - one, or several
export function auctionForumIds () {
	return configuredIds('customAuctionForumId');
}


// The thread a user is allowed to auction from is one they started themselves,
// in a forum set aside for it. Returns the thread, or throws saying why not.
export async function requireOwnAuctionThread (interaction) {
	const forums = auctionForumIds();
	if (!forums.length) throw new Error(MISSING_FORUM);

	const channel = interaction.channel;
	if (!channel?.isThread?.()) throw new Error('Auctions have to be started from your own post in the auction forum.');
	if (!forums.includes(String(channel.parentId))) throw new Error('That is not the auction forum. Start a post in <#' + forums[0] + '> and run this from there.');
	if (String(channel.ownerId) !== interaction.user.id) throw new Error('You can only auction things from a post you started yourself.');

	return channel;
}


export function openAuctionsBy (userId) {
	return store.getOpenAuctions().filter(auction => auction.kind === 'custom' && auction.sellerId === userId);
}


export default {
	kind: 'custom',
	wonText: 'The seller has been paid, and will hand it over themselves.',

	prepare (auction) {
		if (!auction.sellerId) throw new Error('A user auction has to have somebody selling it.');
		if (!auction.itemId) throw new Error('A user auction has to be in a thread.');
		if (!auction.title) throw new Error('Say what you are selling.');

		const max = Number(auctionConfig('customMaxOpenPerUser'));
		if (openAuctionsBy(auction.sellerId).length >= max)
			throw new Error('You already have ' + max + ' auction' + (max === 1 ? '' : 's') + ' running. Wait for one to finish before starting another.');
	},

	durationHours () {
		return Number(auctionConfig('customAuctionDurationHours'));
	},

	//it is posted in the seller's own thread, which is what itemId is
	thread (auction) {
		return resolveThread(auction.itemId, 'That auction thread has gone.');
	},

	introText (auction) {
		return '<@' + auction.sellerId + '> is auctioning something!';
	},

	embedTitle (auction) {
		return auction.title;
	},

	embedDescription (auction) {
		return auction.details || 'Up for auction!';
	},

	closedDescription (auction, resultText) {
		return resultText;
	},

	shortName (auction) {
		return auction.title;
	},

	itemLabel (auction) {
		return '**' + auction.title + '**';
	},

	extraFields () {
		return [{
			name: 'Handover',
			value: 'The bot handles the pikzels. The seller sends what was sold themselves.',
		}];
	},

	//nothing is held, because the bot never has it in the first place
	escrow () {},
	restore () {},
	deliver () {},

	//both of them are told what happens next, in the thread where they can
	//actually talk to each other about it
	async onSold (auction, bid) {
		try {
			const thread = await client.channels.fetch(auction.channelId);
			await thread.send({
				content: '<@' + auction.sellerId + '> has been paid **' + bid.amount + 'P** - over to you to send '
					+ '<@' + bid.userId + '> the goods.',
			});
		}
		catch (err) {
			console.error('Could not post the handover note for auction', auction.id, err);
		}
	},
};

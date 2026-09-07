// Settings for the kinds of auction that are not LFTs.
//
// LFT settings stayed where they were, in the `lft-data` store, so that nothing
// already configured had to move. Everything else lives here, and admins can
// read and change all of it with `/config <...> auction-data`.

import { AUCTION_DATA } from '../data.js';

export const CONFIG_DEFAULTS = {
	//roles
	roleAuctionDurationHours: 96,
	roleMinimumStartingBid: 1,
	//what an abandoned role is relisted at when its holder leaves the server
	roleAbandonedStartingBid: 1,
	//whether a tradeable role that nobody holds gets put up on its own. this is
	//what eventually rescues a role whose holder left while the bot was down
	autoAuctionUnheldRoles: true,
	//how often to go looking for those. checking means asking discord for the
	//whole member list, so it is not something to do every minute
	roleSweepMinutes: 30,
	//how long after an auction ends to leave its role alone, so that a sweep
	//running before discord has caught up cannot relist what was just delivered
	roleSettleGraceMinutes: 15,
	//roles the bot has been told it may auction. managed with `/role tradeable`
	tradeableRoles: [],

	//user run auctions
	customAuctionDurationHours: 96,
	customMinimumStartingBid: 1,
	//how many auctions one person may have running at once
	customMaxOpenPerUser: 3,
};

//assert initialises the store, and creates the keys blank if they are missing
await AUCTION_DATA.assert('roleAuctionThreadId', 'customAuctionForumId', false);

for (const [key, value] of Object.entries(CONFIG_DEFAULTS))
	if (AUCTION_DATA.get(key) === undefined || AUCTION_DATA.get(key) === '') AUCTION_DATA.set(key, value);


export function auctionConfig (key) {
	const value = AUCTION_DATA.get(key);
	if (value === undefined || value === '' || value === null) return CONFIG_DEFAULTS[key];
	return value;
}

export function setAuctionConfig (key, value) {
	return AUCTION_DATA.set(key, value);
}


//a channel setting may name one channel or several, so both are accepted
export function configuredIds (key) {
	const value = auctionConfig(key);
	if (Array.isArray(value)) return value.map(String).filter(Boolean);
	if (value === undefined || value === null || value === '') return [];
	return [String(value)];
}

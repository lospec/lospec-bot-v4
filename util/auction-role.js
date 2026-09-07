// Role auctions.
//
// Some discord roles are marked tradeable, and those are bought and sold like
// anything else - except that there is no inventory behind them. The role is
// the item: putting one up for auction takes it off you there and then, and
// winning one has the bot hand it straight over. Only one person holds a
// tradeable role at a time, which is what makes it worth having.
//
// A role whose holder leaves the server is nobody's, so it goes back up for
// auction on its own, starting at a pikzel.

import client from '../client.js';
import * as store from './lft-store.js';
import { AUCTION_DATA } from '../data.js';
import { auctionConfig } from './auction-config.js';
import { createAuction, resolveThread, TREASURY } from './auctions.js';

const MISSING_THREAD = 'The role auction thread has not been set up yet. An admin needs to set `roleAuctionThreadId` in the `auction-data` store.';

const REASON = 'lospec role auction';


// ------------------------------------------------- which roles are tradeable

// The list lives in the `auction-data` store rather than in code, so that
// moderators can change it without a deploy - see `/role tradeable`.
export function tradeableRoles (guildId) {
	const roles = auctionConfig('tradeableRoles');
	if (!Array.isArray(roles)) return [];
	return roles.filter(entry => entry && entry.roleId && (!guildId || String(entry.guildId) === String(guildId)));
}

export function isTradeable (roleId) {
	return tradeableRoles().some(entry => String(entry.roleId) === String(roleId));
}

export function tradeableRole (roleId) {
	return tradeableRoles().find(entry => String(entry.roleId) === String(roleId));
}


export async function markTradeable (role, byUserId) {
	if (isTradeable(role.id)) throw new Error(role.name + ' is already tradeable.');
	if (role.id === role.guild.id) throw new Error('The everyone role cannot be traded.');
	if (role.managed) throw new Error(role.name + ' is managed by discord or another app, so the bot cannot hand it around.');
	if (!role.editable) throw new Error('The bot cannot give out ' + role.name + '. It needs the Manage Roles permission, and one of its own roles has to sit above that one in the list.');

	//two people holding a role the bot is about to auction off would mean
	//taking it from somebody who never put it up
	const holders = await roleHolders(role.guild, role.id);
	if (holders.length > 1)
		throw new Error(holders.length + ' people have ' + role.name + '. A tradeable role belongs to one person at a time, so take it off the others first.');

	const entry = {
		roleId: role.id,
		guildId: role.guild.id,
		name: role.name,
		addedBy: byUserId || null,
		addedAt: new Date().toISOString(),
	};

	await AUCTION_DATA.set('tradeableRoles', [...tradeableRoles(), entry]);

	return entry;
}


export async function unmarkTradeable (roleId) {
	if (!isTradeable(roleId)) throw new Error('That role was not tradeable in the first place.');

	const auction = openAuctionForRole(roleId);
	if (auction) throw new Error('That role is up for auction right now (#' + auction.id + '), so it cannot be taken off the list until that has finished.');

	await AUCTION_DATA.set('tradeableRoles', tradeableRoles().filter(entry => String(entry.roleId) !== String(roleId)));
}


export function openAuctionForRole (roleId) {
	return store.getOpenAuctionForItem('role', roleId);
}


// ------------------------------------------------------------ who holds one

export async function guildOf (auction) {
	const guildId = auction.guildId || tradeableRole(auction.itemId)?.guildId;
	if (!guildId) throw new Error('That auction is not attached to a server any more.');
	return await client.guilds.fetch(String(guildId));
}


export async function fetchRole (guild, roleId) {
	const role = await guild.roles.fetch(String(roleId));
	if (!role) throw new Error('That role no longer exists.');
	return role;
}


// Discord only tells the bot about members it has seen, and who holds a role is
// worked out from that list - so it has to be asked for in full at least once.
// After that the gateway keeps it up to date, and the sweep asks again anyway.
const fetchedGuilds = new Set();

export async function ensureMemberList (guild, force = false) {
	if (!force && fetchedGuilds.has(guild.id)) return;
	await guild.members.fetch();
	fetchedGuilds.add(guild.id);
}


//everybody currently wearing a role
export async function roleHolders (guild, roleId) {
	const role = await guild.roles.fetch(String(roleId));
	if (!role) return [];

	await ensureMemberList(guild);

	return [...role.members.values()];
}


export async function holderOf (guild, roleId) {
	const holders = await roleHolders(guild, roleId);
	return holders[0] || null;
}


async function fetchMember (guild, userId) {
	try {return await guild.members.fetch(String(userId));}
	catch (err) {return null;}
}


// Hands a tradeable role from one member to another, outside of any auction.
export async function transferRole ({guild, roleId, fromUserId, toUserId, reason = REASON}) {
	const role = await fetchRole(guild, roleId);

	const recipient = await fetchMember(guild, toUserId);
	if (!recipient) throw new Error('They are not in this server.');

	if (fromUserId) {
		const holder = await fetchMember(guild, fromUserId);
		if (!holder || !holder.roles.cache.has(role.id)) throw new Error('You do not have that role.');
		await holder.roles.remove(role, reason);
	}

	await recipient.roles.add(role, reason);

	return role;
}


// ------------------------------------------------------------- the handler

export default {
	kind: 'role',
	wonText: 'It has been applied to your account.',

	async prepare (auction) {
		if (!isTradeable(auction.itemId)) throw new Error('That role is not one of the tradeable ones.');
		if (openAuctionForRole(auction.itemId)) throw new Error('That role is already up for auction.');

		auction.guildId = auction.guildId || tradeableRole(auction.itemId).guildId;

		const guild = await guildOf(auction);
		const role = await fetchRole(guild, auction.itemId);

		//kept on the auction so its messages still read properly if the role is
		//renamed, or deleted out from under a finished auction
		auction.roleName = role.name;

		if (!role.editable) throw new Error('The bot cannot hand out ' + role.name + ' - one of its own roles has to sit above that one.');

		if (auction.sellerId) {
			const seller = await fetchMember(guild, auction.sellerId);
			if (!seller || !seller.roles.cache.has(role.id)) throw new Error('You do not have that role, so you cannot auction it.');
		}
	},

	durationHours () {
		return Number(auctionConfig('roleAuctionDurationHours'));
	},

	thread () {
		return resolveThread(AUCTION_DATA.get('roleAuctionThreadId'), MISSING_THREAD);
	},

	introText (auction) {
		return auction.sellerId
			? '<@' + auction.sellerId + '> has put a role up for auction!'
			: 'A role has come free and is going under the hammer!';
	},

	embedTitle (auction) {
		return '@' + (auction.roleName || 'role');
	},

	//mentions inside an embed render without pinging anybody
	embedDescription (auction) {
		return '<@&' + auction.itemId + '> is up for auction! Whoever wins it gets the role, and nobody else has it.';
	},

	closedDescription (auction, resultText) {
		return '<@&' + auction.itemId + '> ' + resultText;
	},

	shortName (auction) {
		return '@' + (auction.roleName || 'role');
	},

	itemLabel (auction) {
		return 'the **@' + (auction.roleName || 'role') + '** role';
	},

	async color (auction) {
		try {
			const role = await fetchRole(await guildOf(auction), auction.itemId);
			return role.color || null;
		}
		catch (err) {return null;}
	},

	//a role is taken off whoever has it the moment it goes up, so it cannot be
	//given away or worn while it is being bid on. the seller is dealt with by
	//name rather than by looking them up in the member list, which is the one
	//part of this that must not depend on the cache being complete
	async escrow (auction) {
		const guild = await guildOf(auction);
		const role = await fetchRole(guild, auction.itemId);

		if (auction.sellerId) {
			const seller = await fetchMember(guild, auction.sellerId);
			if (seller) await seller.roles.remove(role, REASON);
		}

		//and anybody else who somehow has it as well, because only one person
		//can be holding a tradeable role when it goes up
		for (const member of await roleHolders(guild, role.id))
			if (member.id !== auction.sellerId) await member.roles.remove(role, REASON);
	},

	async deliver (auction, userId) {
		const guild = await guildOf(auction);
		const role = await fetchRole(guild, auction.itemId);

		const member = await fetchMember(guild, userId);
		if (!member) throw new Error('The winner is not in the server any more.');

		await member.roles.add(role, REASON);
	},

	//an unsold role goes back to whoever put it up. one the treasury was
	//selling has nobody to go back to, and the sweep will relist it
	async restore (auction) {
		if (!auction.sellerId) return;

		const guild = await guildOf(auction);
		const role = await fetchRole(guild, auction.itemId);

		const member = await fetchMember(guild, auction.sellerId);
		if (!member) return console.warn('The seller of role auction', auction.id, 'has left, so the role stays free');

		await member.roles.add(role, REASON);
	},

	async canBid (auction, userId) {
		const guild = await guildOf(auction);
		if (!await fetchMember(guild, userId)) return 'You have to be in the server to bid on one of its roles.';
	},

	async canReceive (auction, userId) {
		const guild = await guildOf(auction);
		if (!await fetchMember(guild, userId)) return 'they left the server before the auction closed';
	},

	async onTick () {
		await sweepForFreeRoles();
	},
};


// ------------------------------------------------- roles that nobody has

// A role with no holder and no auction is one nobody can win, so it goes back
// on the market. This is what eventually rescues a role whose owner left while
// the bot was down, or one that has just been marked tradeable.
//
// Working out who holds a role means having the whole member list, so this runs
// on a slow timer of its own rather than on every tick.
let lastSweep = 0;

export async function sweepForFreeRoles (force = false) {
	if (!auctionConfig('autoAuctionUnheldRoles')) return;
	if (!AUCTION_DATA.get('roleAuctionThreadId')) return;

	const every = Number(auctionConfig('roleSweepMinutes')) * 60 * 1000;
	if (!force && Date.now() - lastSweep < every) return;
	lastSweep = Date.now();

	const entries = tradeableRoles();
	if (!entries.length) return;

	for (const guildId of [...new Set(entries.map(entry => String(entry.guildId)))]) {
		try {
			const guild = await client.guilds.fetch(guildId);
			//once, for the whole guild, rather than once per role
			await ensureMemberList(guild, true);

			for (const entry of entries.filter(e => String(e.guildId) === guildId))
				await checkRoleIsHeld(guild, entry);
		}
		catch (err) {
			console.error('Could not check the tradeable roles in guild', guildId, err);
		}
	}
}


async function checkRoleIsHeld (guild, entry) {
	if (openAuctionForRole(entry.roleId)) return;

	const role = await guild.roles.fetch(String(entry.roleId)).catch(() => null);
	if (!role) return console.warn('Tradeable role', entry.roleId, 'no longer exists in', guild.name);

	if (role.members.size > 1)
		return console.warn('Tradeable role', role.name, 'is worn by', role.members.size, 'people - it should be one');

	if (role.members.size === 1) return;

	//discord may not have caught up with a delivery from a moment ago, so a
	//role that has just been through an auction is left alone for a while
	const grace = Number(auctionConfig('roleSettleGraceMinutes')) * 60 * 1000;
	const recent = store.getAuctionsForItem('role', role.id)
		.some(auction => auction.settledAt && Date.now() - new Date(auction.settledAt).getTime() < grace);
	if (recent) return;

	console.log('nobody has the tradeable role', role.name, '- putting it up for auction');

	await createAuction({
		kind: 'role',
		itemId: role.id,
		sellerId: TREASURY,
		startingBid: Number(auctionConfig('roleAbandonedStartingBid')),
		guildId: guild.id,
	});
}


// The fast path for the same thing: somebody with a tradeable role leaves, and
// it goes straight back up. Discord tells us nothing about a member it has not
// seen before, so the sweep above is what catches the rest.
client.on('guildMemberRemove', async member => {
	try {
		if (!AUCTION_DATA.get('roleAuctionThreadId')) return;

		const entries = tradeableRoles(member.guild?.id);
		if (!entries.length) return;

		for (const entry of entries) {
			if (!member.roles?.cache?.has(String(entry.roleId))) continue;
			if (openAuctionForRole(entry.roleId)) continue;

			console.log(member.id, 'left with the tradeable role', entry.name, '- putting it up for auction');

			await createAuction({
				kind: 'role',
				itemId: entry.roleId,
				sellerId: TREASURY,
				startingBid: Number(auctionConfig('roleAbandonedStartingBid')),
				guildId: member.guild.id,
			});
		}
	}
	catch (err) {
		console.error('Could not deal with the roles of a member who left', err);
	}
});

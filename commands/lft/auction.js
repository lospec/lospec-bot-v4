import { LFT_DATA } from '../../data.js';
import * as store from '../../util/lft-store.js';
import { findLft, lftLabel, lftConfig } from '../../util/lft.js';
import { createAuction } from '../../util/lft-auctions.js';

//not required - the command still loads without it and says so when used
await LFT_DATA.assert('marketplaceThreadId', false);

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	const lft = findLft(interaction.options.getString('lft'));
	if (!lft) return interaction.editReply({content: 'No LFT by that name or number exists.'});

	const startingBid = interaction.options.getInteger('starting_bid') || Number(lftConfig('minimumStartingBid'));

	if (!store.getInventoryRow(interaction.user.id, lft.number))
		return interaction.editReply({content: 'You do not own ' + lftLabel(lft) + ', so you cannot auction it.'});

	if (store.getOpenAuctionForLft(lft.number))
		return interaction.editReply({content: lftLabel(lft) + ' is already up for auction.'});

	try {
		const auction = await createAuction({lftNumber: lft.number, sellerId: interaction.user.id, startingBid});
		const hours = Number(lftConfig('auctionDurationHours'));

		await interaction.editReply({
			content: lftLabel(lft) + ' is up for auction starting at **' + auction.startingBid + 'P**.\n\n'
				+ 'Bidding closes in ' + (hours % 24 === 0 ? (hours / 24) + ' days' : hours + ' hours')
				+ ' and you will be paid whatever it goes for. '
				+ (auction.channelId ? 'https://discord.com/channels/' + (interaction.guildId || '@me') + '/' + auction.channelId + '/' + auction.messageId : ''),
		});
	}
	catch (err) {
		console.error('lft auction failed:', err);
		await interaction.editReply({content: 'That auction could not be started. ' + err.message});
	}
};

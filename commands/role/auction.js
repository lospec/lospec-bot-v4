import { createAuction, auctionLink } from '../../util/auctions.js';
import { auctionConfig } from '../../util/auction-config.js';
import { isTradeable, openAuctionForRole } from '../../util/auction-role.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	if (!interaction.guild) return interaction.editReply({content: 'This only works in a server.'});

	const role = interaction.options.getRole('role');
	const startingBid = interaction.options.getInteger('starting_bid') || Number(auctionConfig('roleMinimumStartingBid'));

	if (!isTradeable(role.id))
		return interaction.editReply({content: role.toString() + ' is not a tradeable role. `/role list` shows the ones that are.'});

	if (openAuctionForRole(role.id))
		return interaction.editReply({content: role.toString() + ' is already up for auction.'});

	if (!interaction.member.roles.cache.has(role.id))
		return interaction.editReply({content: 'You do not have ' + role.toString() + ', so you cannot auction it.'});

	try {
		const auction = await createAuction({
			kind: 'role',
			itemId: role.id,
			sellerId: interaction.user.id,
			startingBid,
			guildId: interaction.guild.id,
		});

		const hours = Number(auctionConfig('roleAuctionDurationHours'));

		await interaction.editReply({
			content: role.toString() + ' is up for auction starting at **' + auction.startingBid + 'P**.\n\n'
				+ 'It has been taken off you for now. Bidding closes in '
				+ (hours % 24 === 0 ? (hours / 24) + ' days' : hours + ' hours')
				+ ', you will be paid whatever it goes for, and if nobody bids you get it back. '
				+ auctionLink(auction, interaction.guildId),
		});
	}
	catch (err) {
		console.error('role auction failed:', err);
		await interaction.editReply({content: 'That auction could not be started. ' + err.message});
	}
};

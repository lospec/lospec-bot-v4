import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { createAuction, auctionLink } from '../util/auctions.js';
import { auctionConfig } from '../util/auction-config.js';
import { requireOwnAuctionThread } from '../util/auction-custom.js';

export const config = {
	name: 'auction',
	description: 'Auction something of your own, from your post in the auction forum',
	type: ApplicationCommandType.ChatInput,
	dm_permission: false,
	options: [
		{
			name: 'title',
			description: 'What you are selling',
			type: ApplicationCommandOptionType.String,
			required: true,
			max_length: 100,
		},
		{
			name: 'starting_bid',
			description: 'The lowest bid you will accept (default: 1P)',
			type: ApplicationCommandOptionType.Integer,
			required: false,
			min_value: 1,
		},
		{
			name: 'details',
			description: 'Anything else the buyer should know',
			type: ApplicationCommandOptionType.String,
			required: false,
			max_length: 1000,
		},
	],
};


export const execute = async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	let thread;
	try {thread = await requireOwnAuctionThread(interaction);}
	catch (err) {return interaction.editReply({content: err.message});}

	const title = interaction.options.getString('title').trim();
	const details = interaction.options.getString('details')?.trim() || null;

	const minimum = Number(auctionConfig('customMinimumStartingBid'));
	const startingBid = Math.max(minimum, interaction.options.getInteger('starting_bid') || minimum);

	try {
		const auction = await createAuction({
			kind: 'custom',
			itemId: thread.id,
			sellerId: interaction.user.id,
			startingBid,
			guildId: interaction.guild?.id || null,
			title,
			details,
		});

		const hours = Number(auctionConfig('customAuctionDurationHours'));

		await interaction.editReply({
			content: '**' + title + '** is up for auction starting at **' + auction.startingBid + 'P**.\n\n'
				+ 'Bidding closes in ' + (hours % 24 === 0 ? (hours / 24) + ' days' : hours + ' hours')
				+ '. The bot will charge the winner and pay you — **sending them what they bought is up to you.** '
				+ 'It cannot be called off once it is up, so check it over. '
				+ auctionLink(auction, interaction.guildId),
		});
	}
	catch (err) {
		console.error('custom auction failed:', err);
		await interaction.editReply({content: 'That auction could not be started. ' + err.message});
	}
};

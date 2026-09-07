import { AUCTION_DATA } from '../../data.js';
import { AUCTION_COLOR, auctionLink } from '../../util/auctions.js';
import { tradeableRoles, holderOf, openAuctionForRole } from '../../util/auction-role.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	if (!interaction.guild) return interaction.editReply({content: 'This only works in a server.'});

	const entries = tradeableRoles(interaction.guild.id);
	if (!entries.length) return interaction.editReply({content: 'No roles are tradeable yet. An admin can make one tradeable with `/role tradeable`.'});

	const lines = [];

	for (const entry of entries) {
		const auction = openAuctionForRole(entry.roleId);
		const holder = auction ? null : await holderOf(interaction.guild, entry.roleId);

		lines.push('<@&' + entry.roleId + '> — ' + (auction
			? 'up for auction, ends <t:' + Math.floor(new Date(auction.endsAt).getTime() / 1000) + ':R> ' + auctionLink(auction, interaction.guildId)
			: holder ? 'held by ' + holder.toString() : 'nobody has it'));
	}

	await interaction.editReply({
		embeds: [{
			title: 'Tradeable roles',
			description: lines.join('\n'),
			color: AUCTION_COLOR,
			fields: [{
				name: 'Getting one',
				value: 'Only one person can have each of these at a time. Bid on one when it comes up in '
					+ auctionThread() + ', or ask whoever has it to `/role give` it to you. '
					+ 'Put one of yours up yourself with `/role auction`.',
			}],
			footer: {text: 'A role whose owner leaves the server goes back up for auction on its own.'},
		}],
	});
};


function auctionThread () {
	const threadId = AUCTION_DATA.get('roleAuctionThreadId');
	return threadId ? '<#' + threadId + '>' : 'the role auction thread';
}

import { LFT_DATA } from '../../data.js';
import * as store from '../../util/lft-store.js';
import { lftConfig } from '../../util/lft.js';
import { MAX_APPLICATION_EMOJIS } from '../../util/lft-emoji.js';

export default async (interaction) => {
	const hours = Number(lftConfig('auctionDurationHours'));
	const duration = hours % 24 === 0 ? (hours / 24) + ' days' : hours + ' hours';
	const marketplace = marketplaceLink(interaction);

	await interaction.reply({
		ephemeral: true,
		embeds: [{
			title: 'Lospec Funky Thingies',
			description: 'LFTs are collectable pixel art. Each one is unique, has its own name and number, '
				+ 'and lives as an emoji the bot can post anywhere. There is room for '
				+ MAX_APPLICATION_EMOJIS.toLocaleString() + ' of them, and '
				+ store.getLftCount() + ' exist so far.',
			color: 0xffb300,
			fields: [
				{
					name: 'Getting one',
					value: 'The treasury releases a new LFT every ' + Number(lftConfig('seedIntervalHours'))
						+ ' hours and auctions it off in ' + (marketplace || 'the pikzel marketplace') + '. '
						+ 'Press **Place Bid** on the auction to make an offer.\n\n'
						+ 'You cannot bid more than you have. Bids are not charged when you make them — the '
						+ 'winner pays when the auction closes, and if you cannot pay by then it goes to the '
						+ 'next highest bidder instead. So do not bid what you cannot afford.',
				},
				{
					name: 'Your collection',
					value: '`/lft inventory` shows everything you own, and `/lft info` looks up any LFT ever made.',
				},
				{
					name: 'Selling and trading',
					value: '`/lft auction` puts one of yours up in the marketplace for ' + duration + ', and you '
						+ 'keep every pikzel it sells for. `/lft give` hands one straight to somebody else, free.',
				},
			],
			footer: {text: 'LFTs are minted by the treasury - they cannot be made to order.'},
		}],
	});
};


//a jump link to the marketplace thread, if it has been set up
function marketplaceLink (interaction) {
	const threadId = LFT_DATA.get('marketplaceThreadId');
	if (!threadId || !interaction.guildId) return null;

	return '[the marketplace](https://discord.com/channels/' + interaction.guildId + '/' + threadId + ')';
}

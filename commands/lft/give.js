import client from '../../client.js';
import * as store from '../../util/lft-store.js';
import { findLft, lftLabel, withLock } from '../../util/lft.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	const lft = findLft(interaction.options.getString('lft'));
	const recipient = interaction.options.getUser('user');

	if (!lft) return interaction.editReply({content: 'No LFT by that name or number exists.'});
	if (recipient.bot) return interaction.editReply({content: 'Bots have no use for LFTs.'});
	if (recipient.id === interaction.user.id) return interaction.editReply({content: 'You already own that one.'});

	if (!store.getInventoryRow(interaction.user.id, lft.number))
		return interaction.editReply({content: 'You do not own ' + lftLabel(lft) + '.'});

	if (store.getOpenAuctionForLft(lft.number))
		return interaction.editReply({content: lftLabel(lft) + ' is up for auction right now, so you cannot give it away.'});

	try {
		await withLock('lft-' + lft.number, async () => {
			//re-checked inside the lock in case it moved on while we waited
			if (!store.getInventoryRow(interaction.user.id, lft.number)) throw new Error('You do not own that LFT any more.');
			if (store.getOpenAuctionForLft(lft.number)) throw new Error('That LFT went up for auction.');

			await store.removeFromInventory(interaction.user.id, lft.number, 1);
			await store.addToInventory(recipient.id, lft.number, 1);
		});
	}
	catch (err) {
		return interaction.editReply({content: 'That LFT could not be given away. ' + err.message});
	}

	console.log(interaction.user.id, 'gave LFT #' + lft.number, 'to', recipient.id);

	await interaction.editReply({content: 'You gave ' + lftLabel(lft) + ' to ' + recipient.toString() + '.'});

	try {
		const user = await client.users.fetch(recipient.id);
		await user.send({
			embeds: [{
				title: 'You were given an LFT!',
				description: interaction.user.toString() + ' gave you ' + lftLabel(lft) + '. It is in your inventory now.',
				color: 0x43b581,
			}],
		});
	}
	catch (err) {
		console.warn('Could not DM the recipient of an LFT gift', err.message);
	}
};

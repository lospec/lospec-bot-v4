import * as store from '../../util/lft-store.js';
import { findLft, lftLabel } from '../../util/lft.js';
import { emojiTag } from '../../util/lft-emoji.js';

export default async (interaction) => {
	const lft = findLft(interaction.options.getString('lft'));

	if (!lft) return interaction.reply({content: 'No LFT by that name or number exists.', ephemeral: true});

	if (!store.getInventoryRow(interaction.user.id, lft.number))
		return interaction.reply({content: 'You do not own ' + lftLabel(lft) + '.', ephemeral: true});

	//the whole point of the command - the emoji on its own, nothing else
	await interaction.reply({content: emojiTag(lft)});
};

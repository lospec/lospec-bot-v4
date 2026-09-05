import { getStore, requireAdmin, describeType, formatValue } from '../../util/config-store.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	try {requireAdmin(interaction);}
	catch (err) {return interaction.editReply({content: err.message});}

	const slug = interaction.options.getString('store');
	const key = interaction.options.getString('key').trim();
	const value = getStore(slug).get(key);

	await interaction.editReply({
		embeds: [{
			title: slug + ' · ' + key,
			description: formatValue(value, 3900),
			color: 0x5865f2,
			footer: {text: describeType(value)},
		}],
	});
};

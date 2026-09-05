import { getStore, requireAdmin, describeType, formatValue, truncate } from '../../util/config-store.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	try {requireAdmin(interaction);}
	catch (err) {return interaction.editReply({content: err.message});}

	const slug = interaction.options.getString('store');
	const store = getStore(slug);
	const keys = store.keys().sort();

	if (!keys.length) return interaction.editReply({content: 'The `' + slug + '` store is empty.'});

	//embeds allow 25 fields, and every value has to fit in one
	const fields = keys.slice(0, 25).map(key => ({
		name: key,
		value: truncate(formatValue(store.get(key), 200) + '  *(' + describeType(store.get(key)) + ')*', 1024),
	}));

	await interaction.editReply({
		embeds: [{
			title: slug,
			description: keys.length > 25
				? 'Showing 25 of ' + keys.length + ' values. Use `/config get` for the rest.'
				: keys.length + ' value' + (keys.length === 1 ? '' : 's') + '. Use `/config get` to see one in full.',
			color: 0x5865f2,
			fields,
		}],
	});
};

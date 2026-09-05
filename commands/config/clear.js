import { getStore, requireAdmin, formatValue } from '../../util/config-store.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	try {requireAdmin(interaction);}
	catch (err) {return interaction.editReply({content: err.message});}

	const slug = interaction.options.getString('store');
	const key = interaction.options.getString('key').trim();
	const store = getStore(slug);
	const before = store.get(key);

	if (before === undefined || before === '')
		return interaction.editReply({content: '`' + slug + '.' + key + '` is already empty.'});

	try {
		//emptied rather than deleted, which is what assert() treats as missing
		await store.set(key, '');
	}
	catch (err) {
		console.error('/config clear failed', slug, key, err);
		return interaction.editReply({content: 'That value could not be cleared. ' + err.message});
	}

	console.log(interaction.user.tag, 'cleared', slug + '.' + key);

	await interaction.editReply({
		embeds: [{
			title: slug + ' · ' + key,
			description: 'Cleared. It was:\n' + formatValue(before, 3500),
			color: 0xed4245,
		}],
	});
};

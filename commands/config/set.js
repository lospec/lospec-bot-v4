import { getStore, requireAdmin, parseValue, describeType, formatValue } from '../../util/config-store.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	try {requireAdmin(interaction);}
	catch (err) {return interaction.editReply({content: err.message});}

	const slug = interaction.options.getString('store');
	const key = interaction.options.getString('key').trim();
	const type = interaction.options.getString('type') || 'auto';

	if (!key.match(/^[A-Za-z0-9_-]{1,64}$/))
		return interaction.editReply({content: 'That is not a usable key name. Use letters, numbers, dashes and underscores.'});

	let value;
	try {value = parseValue(interaction.options.getString('value'), type);}
	catch (err) {return interaction.editReply({content: err.message});}

	const store = getStore(slug);
	const before = store.get(key);

	try {
		//the local store writes synchronously, the database one hands back the
		//write so a failure can actually be reported instead of swallowed
		await store.set(key, value);
	}
	catch (err) {
		console.error('/config set failed', slug, key, err);
		return interaction.editReply({content: 'That value could not be saved. ' + err.message});
	}

	console.log(interaction.user.tag, 'set', slug + '.' + key, 'to', value);

	await interaction.editReply({
		embeds: [{
			title: slug + ' · ' + key,
			color: 0x43b581,
			fields: [
				{name: 'Was', value: formatValue(before, 400)},
				{name: 'Now', value: formatValue(value, 400) + '  *(' + describeType(value) + ')*'},
			],
			footer: {text: 'Saved. Most values are read as they are used, so this is already live.'},
		}],
	});
};

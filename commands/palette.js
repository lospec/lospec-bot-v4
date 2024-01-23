import { ApplicationCommandType, ApplicationCommandOptionType} from 'discord.js';
import fetch from 'node-fetch';

export const config = {
	name: 'palette', 
	description: 'Fetch a link to a palette hosted on Lospec', 
	type: ApplicationCommandType.ChatInput,
	options: [{
		name: 'slug',
		type: ApplicationCommandOptionType.String,
		description: 'Palette URL slug (the part of the url after /palette-list/)',
		required: true
	}]
};

export const execute = async (interaction) => {
	await interaction.deferReply();

	let paletteSlug = interaction.options.getString('slug');
	if (!paletteSlug) return interaction.editReply({ content: 'you must specify a palette', ephemeral: true })

	let paletteUrl = 'https://lospec.com/palette-list/'+ paletteSlug  + '.json';

	fetch(paletteUrl)
		.then(async res => {
			if (!res.ok) throw 'Palette Not Found';
			let palette = await res.json();
			interaction.editReply({embeds: [{
				title: palette.name + ' by ' + palette.author,
				description: 'https://lospec.com/palette-list/'+ paletteSlug ,
				image: {url: 'https://cdn.lospec.com/thumbnails/palette-list/'+ paletteSlug +'-default.png'} 
			}] });
		})
		.catch(err => {
			console.error(err)
			interaction.editReply({ content: 'Sorry, I couldn\'t find a palette called "'+paletteSlug+'"  ¯\\\_(ツ)_/¯ ', ephemeral: true })
		});
}
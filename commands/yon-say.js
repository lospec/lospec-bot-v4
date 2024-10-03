import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import yonify from '../util/yonify.js';
import yonValidate from '../util/yon-validate.js';

export const config = {
	name: 'yon-say',
	description: 'Say something in yon dungeon as your character',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'input',
			description: 'what you want your character to say in Yon Dungeon',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	]
};

export const execute = async (interaction) => {
	let input = interaction.options.getString('input');

	let {user} = await yonValidate(interaction);

	await interaction.channel.send({embeds: [{
		author: {
			name: user.name+':',
			//icon_url: user.avatar
		},
		description: '```"'+yonify(input)+'"```'
	}]});

	await interaction.reply({content: '```"'+yonify('your message has been sent')+'"```', ephemeral: true});
}
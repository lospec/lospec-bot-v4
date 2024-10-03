import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import yonify from '../util/yonify.js';
import yonValidate from '../util/yon-validate.js';
import {YON_DATA,YON_CONFIG} from '../data.js';

export const config = {
	name: 'yon-speak',
	description: 'Say something as an NPC in Yon Dungeon',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'input',
			description: 'what you want your character to say in Yon Dungeon',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
		{
			name: 'character-name',
			description: 'The name of the NPC character',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	]
};

export const execute = async (interaction) => {
	let input = interaction.options.getString('input');
	let characterName = interaction.options.getString('character-name');

	await interaction.channel.send({embeds: [{
		author: {
			name: yonify(characterName) +':',
			//icon_url: user.avatar
		},
		description: '```"'+yonify(input)+'"```'
	}]});

	await interaction.reply({content: '```"'+yonify('your characters message has been sent')+'"```', ephemeral: true});
}
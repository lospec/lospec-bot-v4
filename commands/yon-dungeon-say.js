import { ApplicationCommandType, ApplicationCommandOptionType} from 'discord.js';
import {CONFIG} from '../data.js';

export const config = {
	name: 'say', 
	description: 'Say something as your character', 
	type: ApplicationCommandType.ChatInput,
	options: [{
		name: 'text',
		type: ApplicationCommandOptionType.String,
		description: 'The text that your character says',
		required: true
	}]
};

export const execute = async (interaction) => {
	interaction.reply({ content: 'You said: '+interaction.options.getString('text'), ephemeral: true });
}
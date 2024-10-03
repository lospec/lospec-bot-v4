import { ApplicationCommandType, ApplicationCommandOptionType} from 'discord.js';
import client from '../client.js';

export const config = {
	name: 'restart', 
	description: 'Restart this discord bot', 
	type: ApplicationCommandType.ChatInput
};

export const execute = async (interaction) => {
	await interaction.reply({content: 'Restarting...', ephemeral: true});
	client.destroy();
	process.exit(0);
};
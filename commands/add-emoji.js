import { ApplicationCommandType, ApplicationCommandOptionType} from 'discord.js';

export const config = {
	name: 'add-emoji', 
	description: 'Add an emoji from the Lospec Emoji Archive to the server (costs 20P)', 
	type: ApplicationCommandType.ChatInput,
};

export const execute = async (interaction) => {
	await interaction.reply({ content: 'This command is not implemented yet', ephemeral: true });
};
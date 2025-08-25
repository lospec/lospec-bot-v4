import { ApplicationCommandType, PermissionFlagsBits } from 'discord.js';
import client from '../client.js';

export const config = {
	name: 'restart',
	description: 'Admin: Restart this discord bot',
	default_member_permissions: (PermissionFlagsBits.ManageGuild).toString(),
	dm_permission: false,
	type: ApplicationCommandType.ChatInput,
	options: []
};

export const execute = async (interaction) => {
	await interaction.reply({content: 'Restarting...', ephemeral: true});
	client.destroy();
	process.exit(0);
};
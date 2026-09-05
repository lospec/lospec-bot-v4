import { ApplicationCommandType, PermissionFlagsBits } from 'discord.js';
import client from '../client.js';
import { recordStop } from '../status.js';

export const config = {
	name: 'restart',
	description: 'Admin: Restart this discord bot',
	default_member_permissions: (PermissionFlagsBits.ManageGuild).toString(),
	dm_permission: false,
	type: ApplicationCommandType.ChatInput,
	options: []
};

export const execute = async (interaction) => {
	//the permissions above can be overridden per server, so check here as well
	if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
		return interaction.reply({content: 'Only server managers can restart the bot.', ephemeral: true});

	await interaction.reply({content: 'Restarting...', ephemeral: true});

	//so the next run can say this was deliberate, and who asked for it
	recordStop('restart', interaction.user.tag);

	client.destroy();
	process.exit(0);
};
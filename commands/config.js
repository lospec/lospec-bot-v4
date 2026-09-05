import { ApplicationCommandType, ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { STORE_SLUGS, TYPE_CHOICES } from '../util/config-store.js';

const storeOption = {
	name: 'store',
	description: 'Which data store the value lives in',
	type: ApplicationCommandOptionType.String,
	required: true,
	choices: STORE_SLUGS.map(slug => ({name: slug, value: slug})),
};

const keyOption = {
	name: 'key',
	description: 'The name of the value',
	type: ApplicationCommandOptionType.String,
	required: true,
	autocomplete: true,
};

export const config = {
	name: 'config',
	description: 'Read and change the bot\'s configuration',
	type: ApplicationCommandType.ChatInput,
	//hides the command from everybody but admins, and discord enforces it
	//before the interaction is ever sent to the bot
	default_member_permissions: String(PermissionFlagsBits.Administrator),
	dm_permission: false,
	options: [
		{
			name: 'list',
			description: 'Show everything in a data store',
			type: ApplicationCommandOptionType.Subcommand,
			options: [storeOption],
		},
		{
			name: 'get',
			description: 'Show one value in full',
			type: ApplicationCommandOptionType.Subcommand,
			options: [storeOption, keyOption],
		},
		{
			name: 'set',
			description: 'Change a value',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				storeOption,
				keyOption,
				{
					name: 'value',
					description: 'The new value',
					type: ApplicationCommandOptionType.String,
					required: true,
				},
				{
					name: 'type',
					description: 'How to store it (default: auto, which guesses)',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: TYPE_CHOICES.map(type => ({name: type, value: type})),
				},
			],
		},
		{
			name: 'clear',
			description: 'Empty a value, as though it had never been set',
			type: ApplicationCommandOptionType.Subcommand,
			options: [storeOption, keyOption],
		},
	],
};

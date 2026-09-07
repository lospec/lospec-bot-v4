import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';

export const config = {
	name: 'role',
	description: 'Buy, sell and hand on the tradeable roles',
	type: ApplicationCommandType.ChatInput,
	dm_permission: false,
	options: [
		{
			name: 'list',
			description: 'The roles that can be traded, and who has them',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'auction',
			description: 'Put a role you have up for auction',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'role',
					description: 'Which of your roles to auction',
					type: ApplicationCommandOptionType.Role,
					required: true,
				},
				{
					name: 'starting_bid',
					description: 'The lowest bid you will accept (default: 1P)',
					type: ApplicationCommandOptionType.Integer,
					required: false,
					min_value: 1,
				},
			],
		},
		{
			name: 'give',
			description: 'Hand one of your roles straight to somebody else',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'role',
					description: 'Which of your roles to give away',
					type: ApplicationCommandOptionType.Role,
					required: true,
				},
				{
					name: 'user',
					description: 'Who to give it to',
					type: ApplicationCommandOptionType.User,
					required: true,
				},
			],
		},
		{
			name: 'tradeable',
			description: 'Admin: say whether a role can be traded at all',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'role',
					description: 'The role',
					type: ApplicationCommandOptionType.Role,
					required: true,
				},
				{
					name: 'tradeable',
					description: 'Whether people may auction and give this role',
					type: ApplicationCommandOptionType.Boolean,
					required: true,
				},
			],
		},
	],
};

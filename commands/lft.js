import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';

export const config = {
	name: 'lft',
	description: 'Lospec Funky Thingies - collectable pixel art',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'inventory',
			description: 'See the LFTs you own',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'info',
			description: 'Look up an LFT',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'lft',
					description: 'The name or number of the LFT',
					type: ApplicationCommandOptionType.String,
					required: true,
					autocomplete: true,
				},
				{
					name: 'public',
					description: 'Post the result publicly instead of just for you (default: false)',
					type: ApplicationCommandOptionType.Boolean,
					required: false,
				},
			],
		},
		{
			name: 'auction',
			description: 'Put one of your LFTs up for auction in the marketplace',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'lft',
					description: 'Which of your LFTs to auction',
					type: ApplicationCommandOptionType.String,
					required: true,
					autocomplete: true,
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
			description: 'Give one of your LFTs to somebody else',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'lft',
					description: 'Which of your LFTs to give away',
					type: ApplicationCommandOptionType.String,
					required: true,
					autocomplete: true,
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
			name: 'help',
			description: 'What LFTs are and how to collect them',
			type: ApplicationCommandOptionType.Subcommand,
		},
	],
};

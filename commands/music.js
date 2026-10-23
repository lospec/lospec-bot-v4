import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { STATIONS } from '../util/music-library.js';
import '../util/music-player.js';

export const config = {
	name: 'music',
	description: 'Play chiptunes in a voice channel',
	type: ApplicationCommandType.ChatInput,
	dm_permission: false,
	options: [
		{
			name: 'join',
			description: 'Bring the bot into your voice channel to play a station',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'station',
					description: 'Which station to play (default: chill)',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: Object.entries(STATIONS).map(([value, name]) => ({name, value})),
				},
			],
		},
		{
			name: 'play',
			description: 'Queue a song to play next',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'song',
					description: 'The song to play',
					type: ApplicationCommandOptionType.String,
					required: true,
					autocomplete: true,
				},
			],
		},
		{
			name: 'skip',
			description: 'Skip the song that is playing',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'station',
			description: 'Switch to another station',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'station',
					description: 'Which station to play',
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: Object.entries(STATIONS).map(([value, name]) => ({name, value})),
				},
			],
		},
		{
			name: 'list',
			description: 'Get a file listing every song on a station',
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: 'station',
					description: 'Which station to list (default: all of them)',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: Object.entries(STATIONS).map(([value, name]) => ({name, value})),
				},
			],
		},
		{
			name: 'queue',
			description: 'Show what is playing and the songs requested after it',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'stop',
			description: 'Stop playing and leave the voice channel',
			type: ApplicationCommandOptionType.Subcommand,
		},
	],
};

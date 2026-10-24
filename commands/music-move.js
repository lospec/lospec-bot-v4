import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { STATIONS, findSong, findStation, moveSong, code } from '../util/music-library.js';
import { UPLOAD_PERMISSION } from '../util/music-upload.js';

export const config = {
	name: 'music-move',
	description: 'Move a song to another music station',
	type: ApplicationCommandType.ChatInput,
	default_member_permissions: UPLOAD_PERMISSION,
	dm_permission: false,
	options: [
		{
			name: 'song',
			description: 'The song to move',
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
		{
			name: 'station',
			description: 'The station to move it to',
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
	],
};

export const execute = async (interaction) => {
	const song = findSong(interaction.options.getString('song'));
	if (!song) return interaction.reply({content: 'Pick the song from the suggestions.', ephemeral: true});
	const station = findStation(interaction.options.getString('station'));
	if (!station) return interaction.reply({content: 'Pick a station from the suggestions.', ephemeral: true});

	await interaction.deferReply({ephemeral: true});
	try {
		const from = STATIONS[song.station];
		await moveSong(song, station);
		await interaction.editReply({content: 'Moved ' + code(song.name) + ' from the ' + from + ' station to the ' + STATIONS[station] + ' station.'});
	}
	catch (err) {
		console.error('music move failed:', err);
		await interaction.editReply({content: err.message});
	}
};

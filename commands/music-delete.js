import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { STATIONS, findSong, removeSong, code } from '../util/music-library.js';
import { UPLOAD_PERMISSION } from '../util/music-upload.js';

export const config = {
	name: 'music-delete',
	description: 'Remove a song from its music station for good',
	type: ApplicationCommandType.ChatInput,
	default_member_permissions: UPLOAD_PERMISSION,
	dm_permission: false,
	options: [
		{
			name: 'song',
			description: 'The song to delete',
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
	],
};

export const execute = async (interaction) => {
	//only an exact pick from the suggestions, so a typo can't delete the wrong song
	const song = findSong(interaction.options.getString('song'));
	if (!song) return interaction.reply({content: 'Pick the song from the suggestions.', ephemeral: true});

	await interaction.deferReply({ephemeral: true});
	await removeSong(song);
	await interaction.editReply({content: 'Deleted ' + code(song.name) + ' from the ' + STATIONS[song.station] + ' station.'});
};

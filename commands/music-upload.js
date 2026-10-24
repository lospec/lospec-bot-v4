import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { findStation } from '../util/music-library.js';
import { UPLOAD_PERMISSION, addAttachments } from '../util/music-upload.js';

export const config = {
	name: 'music-upload',
	description: 'Add a song to one of the music stations',
	type: ApplicationCommandType.ChatInput,
	default_member_permissions: UPLOAD_PERMISSION,
	dm_permission: false,
	options: [
		{
			name: 'song',
			description: 'An audio file or tracker module, converted to mp3 if needed',
			type: ApplicationCommandOptionType.Attachment,
			required: true,
		},
		{
			name: 'station',
			description: 'Which station to add it to',
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
	],
};

export const execute = async (interaction) => {
	const station = findStation(interaction.options.getString('station'));
	if (!station) return interaction.reply({content: 'Pick a station from the suggestions.', ephemeral: true});

	await interaction.deferReply({ephemeral: true});
	await addAttachments(interaction, station, [interaction.options.getAttachment('song')]);
};

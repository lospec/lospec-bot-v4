import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { STATIONS } from '../util/music-library.js';
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
			choices: Object.entries(STATIONS).map(([value, name]) => ({name, value})),
		},
	],
};

export const execute = async (interaction) => {
	await interaction.deferReply({ephemeral: true});
	await addAttachments(interaction, interaction.options.getString('station'), [interaction.options.getAttachment('song')]);
};

import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { findStation } from '../util/music-library.js';
import { UPLOAD_PERMISSION, addAttachments, addLink } from '../util/music-upload.js';

export const config = {
	name: 'music-upload',
	description: 'Add a song to one of the music stations, from a file or a chiptune.app link',
	type: ApplicationCommandType.ChatInput,
	default_member_permissions: UPLOAD_PERMISSION,
	dm_permission: false,
	options: [
		{
			name: 'station',
			description: 'Which station to add it to',
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
		},
		{
			name: 'song',
			description: 'An audio file, tracker module or game-music file (nsf, spc, vgm, sid, gsf...)',
			type: ApplicationCommandOptionType.Attachment,
		},
		{
			name: 'link',
			description: 'A chiptune.app or gifx.co link to the song, instead of a file',
			type: ApplicationCommandOptionType.String,
		},
		{
			name: 'track',
			description: 'Which track of a file that holds a whole soundtrack (default: the link\'s, or the first)',
			type: ApplicationCommandOptionType.Integer,
			min_value: 1,
		},
		{
			name: 'name',
			description: 'The song\'s name, e.g. "overworld super mario world" (default: from the file)',
			type: ApplicationCommandOptionType.String,
			max_length: 100,
		},
	],
};

export const execute = async (interaction) => {
	const station = findStation(interaction.options.getString('station'));
	if (!station) return interaction.reply({content: 'Pick a station from the suggestions.', ephemeral: true});
	const attachment = interaction.options.getAttachment('song');
	const link = interaction.options.getString('link');
	if (!attachment === !link) return interaction.reply({content: 'Give either a file or a link.', ephemeral: true});

	await interaction.deferReply({ephemeral: true});
	const options = {track: interaction.options.getInteger('track'), name: interaction.options.getString('name')};
	if (link) await addLink(interaction, station, link, options);
	else await addAttachments(interaction, station, [attachment], options);
};

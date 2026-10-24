import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { createStation } from '../util/music-library.js';
import { UPLOAD_PERMISSION } from '../util/music-upload.js';

export const config = {
	name: 'music-create-station',
	description: 'Make a new, empty music station',
	type: ApplicationCommandType.ChatInput,
	default_member_permissions: UPLOAD_PERMISSION,
	dm_permission: false,
	options: [
		{
			name: 'name',
			description: 'What the station is called, e.g. Battle',
			type: ApplicationCommandOptionType.String,
			required: true,
			max_length: 40,
		},
	],
};

export const execute = async (interaction) => {
	await interaction.deferReply({ephemeral: true});
	try {
		await createStation(interaction.options.getString('name'));
		const name = interaction.options.getString('name').replace(/\s+/g, ' ').trim();
		await interaction.editReply({content: 'Made the ' + name + ' station. Add songs to it with /music-upload, /music-move or right click > Apps > Add to music station.'});
	}
	catch (err) {
		console.error('music station creation failed:', err);
		await interaction.editReply({content: err.message});
	}
};

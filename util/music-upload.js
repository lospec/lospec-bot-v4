// Adding songs from discord attachments, shared by /music-upload and the
// "Add to ... station" message commands. Anything that isn't an mp3 - other
// audio files and tracker modules - is converted to one.
//
// These and /music-delete are only visible to administrators until they are given to other roles
// or members in Server Settings > Integrations, and discord enforces that
// before the interaction is ever sent to the bot.

import { ApplicationCommandType, PermissionFlagsBits } from 'discord.js';
import { STATIONS, MAX_SONG_BYTES, addSong, code } from './music-library.js';
import { isSupported } from './music-audio.js';

export const UPLOAD_PERMISSION = String(PermissionFlagsBits.Administrator);

// Adds each attachment to a station, and replies with what happened to each.
// The interaction must already be deferred.
export async function addAttachments (interaction, station, attachments) {
	const lines = [];
	for (const attachment of attachments) {
		try {
			if (!isSupported(attachment.name)) throw new Error(code(attachment.name) + ' is not a supported file. Songs can be audio files or tracker modules.');
			if (attachment.size > MAX_SONG_BYTES) throw new Error(code(attachment.name) + ' is over ' + (MAX_SONG_BYTES / 1024 / 1024) + 'MB.');

			const response = await fetch(attachment.url);
			if (!response.ok) throw new Error('Could not download ' + code(attachment.name) + ' from discord (' + response.status + ').');

			const song = await addSong(station, attachment.name, Buffer.from(await response.arrayBuffer()));
			lines.push('Added ' + code(song.name) + ' to the ' + STATIONS[station] + ' station.');
		}
		catch (err) {
			console.error('music upload failed:', err.message);
			lines.push(err.message);
		}
	}
	await interaction.editReply({content: lines.join('\n')});
}

// A right click > Apps command that adds the songs on a message to one station
export function addToStationCommand (station) {
	return {
		config: {
			name: 'Add to ' + STATIONS[station] + ' station',
			type: ApplicationCommandType.Message,
			default_member_permissions: UPLOAD_PERMISSION,
			dm_permission: false,
		},
		execute: async (interaction) => {
			const attachments = [...interaction.targetMessage.attachments.values()].filter(attachment => isSupported(attachment.name));
			if (!attachments.length) return interaction.reply({content: 'That message has no audio files or tracker modules attached.', ephemeral: true});

			await interaction.deferReply({ephemeral: true});
			await addAttachments(interaction, station, attachments);
		},
	};
}

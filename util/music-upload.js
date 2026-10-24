// Adding songs from discord attachments, shared by /music-upload and the
// "Add to music station" message command. Anything that isn't an mp3 - other
// audio files and tracker modules - is converted to one.
//
// These and the other song-managing commands are only visible to
// administrators until they are given to other roles or members in Server
// Settings > Integrations, and discord enforces that before the interaction is
// ever sent to the bot.

import { ApplicationCommandType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import client from '../client.js';
import { STATIONS, MAX_SONG_BYTES, addSong, loadLibrary, code } from './music-library.js';
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
	await interaction.editReply({content: lines.join('\n'), components: []});
}

// Right click > Apps > Add to music station. A message command can't take
// options, so it replies with a station picker only the person using it sees,
// and picking a station adds every song on the message to it. The picker
// carries the message's channel and id so it can find the files again.
export const addToStationCommand = {
	config: {
		name: 'Add to music station',
		type: ApplicationCommandType.Message,
		default_member_permissions: UPLOAD_PERMISSION,
		dm_permission: false,
	},
	execute: async (interaction) => {
		const message = interaction.targetMessage;
		const songs = [...message.attachments.values()].filter(attachment => isSupported(attachment.name));
		if (!songs.length) return interaction.reply({content: 'That message has no audio files or tracker modules attached.', ephemeral: true});

		await loadLibrary();
		await interaction.reply({
			content: 'Which station should ' + (songs.length === 1 ? code(songs[0].name) + ' be' : 'these ' + songs.length + ' songs be') + ' added to?',
			components: [new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId('music-add:' + message.channelId + ':' + message.id)
					.setPlaceholder('Pick a station')
					.addOptions(Object.entries(STATIONS).map(([value, name]) => ({label: name, value}))),
			)],
			ephemeral: true,
		});
	},
};

client.on('interactionCreate', async interaction => {
	if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('music-add:')) return;
	const [, channelId, messageId] = interaction.customId.split(':');
	const station = interaction.values[0];

	try {
		if (!STATIONS[station]) return interaction.update({content: 'That station no longer exists.', components: []});
		await interaction.update({content: 'Adding to the ' + STATIONS[station] + ' station...', components: []});

		const channel = await client.channels.fetch(channelId);
		const message = await channel.messages.fetch(messageId);
		const songs = [...message.attachments.values()].filter(attachment => isSupported(attachment.name));
		await addAttachments(interaction, station, songs);
	}
	catch (err) {
		console.error('music add failed:', err);
		await interaction.editReply({content: 'The songs could not be added. ' + err.message, components: []}).catch(() => {});
	}
});

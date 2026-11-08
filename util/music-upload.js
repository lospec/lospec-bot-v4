// Adding songs from discord attachments and from chiptune.app/gifx.co links,
// shared by /music-upload and the "Add to music station" message command.
// Anything that isn't an mp3 - other audio files, tracker modules and
// game-music files - is converted to one.
//
// These and the other song-managing commands are only visible to
// administrators until they are given to other roles or members in Server
// Settings > Integrations, and discord enforces that before the interaction is
// ever sent to the bot.

import { ApplicationCommandType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import client from '../client.js';
import { STATIONS, MAX_SONG_BYTES, addSong, loadLibrary, code } from './music-library.js';
import { isSupported, extensionOf } from './music-audio.js';
import { SIDECAR_EXTENSIONS } from './chip-render.js';
import { parseLink, downloadLink, nameFor, songMeta } from './chiptune-links.js';

export const UPLOAD_PERMISSION = String(PermissionFlagsBits.Administrator);

// Adds each attachment to a station, and replies with what happened to each.
// The interaction must already be deferred. Every attachment is saved to one
// folder first, so a game-music file can load the library files attached
// beside it (a minigsf's gsflib, an mdx's pdx). `track` (from 1) and `name`
// apply when there's only one song.
export async function addAttachments (interaction, station, attachments, {track, name} = {}) {
	const lines = [];
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'music-upload-'));
	try {
		const songs = [];
		for (const attachment of attachments) {
			const sidecar = SIDECAR_EXTENSIONS.includes(extensionOf(attachment.name));
			try {
				if (!sidecar && !isSupported(attachment.name)) throw new Error(code(attachment.name) + ' is not a supported file. Songs can be audio files, tracker modules or game-music files.');
				if (attachment.size > MAX_SONG_BYTES) throw new Error(code(attachment.name) + ' is over ' + (MAX_SONG_BYTES / 1024 / 1024) + 'MB.');
				const response = await fetch(attachment.url);
				if (!response.ok) throw new Error('Could not download ' + code(attachment.name) + ' from discord (' + response.status + ').');
				const file = path.join(folder, path.basename(attachment.name));
				fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
				if (!sidecar) songs.push({name: attachment.name, file});
			}
			catch (err) {
				console.error('music upload failed:', err.message);
				lines.push(err.message);
			}
		}
		const single = songs.length === 1;
		for (const song of songs) {
			try {
				const fileName = single && name ? name + path.extname(song.name) : song.name;
				const added = await addSong(station, fileName, fs.readFileSync(song.file), {file: song.file, track: single && track ? track - 1 : 0});
				lines.push('Added ' + code(added.name) + ' to the ' + STATIONS[station] + ' station.');
			}
			catch (err) {
				console.error('music upload failed:', err.message);
				lines.push(err.message);
			}
		}
	}
	finally { fs.rmSync(folder, {recursive: true, force: true}); }
	await interaction.editReply({content: lines.join('\n') || 'There was nothing to add.', components: []});
}

// Adds the song a chiptune.app or gifx.co link points to. `track` (from 1, as
// people count) overrides the link's own, and `name` the name made from the
// file's path. Replies with what happened; the interaction must be deferred.
export async function addLink (interaction, station, text, {track, name} = {}) {
	const link = parseLink(text);
	if (!link) return interaction.editReply('That isn\'t a chiptune.app or gifx.co link.');
	if (track) link.track = track - 1;
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'music-link-'));
	try {
		const {file, path: catalogPath, track: picked} = await downloadLink(link, folder);
		const fileName = (name || nameFor(catalogPath, picked, songMeta(file, fs.readFileSync(file), picked))) + path.extname(file);
		const song = await addSong(station, fileName, fs.readFileSync(file), {file, track: picked});
		await interaction.editReply('Added ' + code(song.name) + ' to the ' + STATIONS[station] + ' station.');
	}
	catch (err) {
		console.error('music link upload failed:', err.message);
		await interaction.editReply(err.message);
	}
	finally { fs.rmSync(folder, {recursive: true, force: true}); }
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
		if (!songs.length) return interaction.reply({content: 'That message has no audio files, tracker modules or game-music files attached.', ephemeral: true});

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

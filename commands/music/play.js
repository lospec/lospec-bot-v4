import { findSong, searchSongs, STATIONS, code } from '../../util/music-library.js';
import { join, enqueue, getSession } from '../../util/music-player.js';

export default async (interaction) => {
	const text = interaction.options.getString('song');
	const song = findSong(text) || searchSongs(text)[0];
	if (!song) return interaction.reply({content: 'No song matches "' + text + '".', ephemeral: true});

	const session = getSession(interaction.guildId);
	if (session) {
		const ahead = enqueue(session, song);
		return interaction.reply({
			content: ahead < 0 ? 'Playing ' + code(song.name) + '.'
				: 'Queued ' + code(song.name) + '. ' + (ahead === 0 ? 'It plays next.' : ahead + (ahead === 1 ? ' song plays' : ' songs play') + ' before it.'),
			ephemeral: true,
		});
	}

	const voiceChannel = interaction.member.voice?.channel;
	if (!voiceChannel) return interaction.reply({content: 'Join a voice channel first.', ephemeral: true});

	await interaction.deferReply({ephemeral: true});
	await join(voiceChannel, song.station, song);
	await interaction.editReply({content: 'Playing ' + code(song.name) + ', then the ' + STATIONS[song.station] + ' station, in ' + voiceChannel.toString() + '.'});
};

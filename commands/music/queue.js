import { STATIONS, code } from '../../util/music-library.js';
import { getSession, upcoming } from '../../util/music-player.js';

const MAX_LISTED = 15;

export default async (interaction) => {
	const session = getSession(interaction.guildId);
	if (!session) return interaction.reply({content: 'Nothing is playing.', ephemeral: true});

	const songs = upcoming(session);
	const lines = [
		'Playing: ' + (session.current ? code(session.current.name) : 'nothing'),
		'Station: ' + STATIONS[session.station],
		'',
		songs.length ? 'Requested:' : 'No songs requested. The station plays next.',
		...songs.slice(0, MAX_LISTED).map((song, i) => (i + 1) + '. ' + code(song.name)),
	];
	if (songs.length > MAX_LISTED) lines.push('and ' + (songs.length - MAX_LISTED) + ' more');

	await interaction.reply({content: lines.join('\n'), ephemeral: true});
};

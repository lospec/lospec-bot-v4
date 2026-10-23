import { STATIONS, listSongs } from '../../util/music-library.js';
import { getSession, setStation, reply } from '../../util/music-player.js';

export default async (interaction) => {
	const session = getSession(interaction.guildId);
	if (!session) return interaction.reply({content: 'Nothing is playing. Use /music join to start a station.', ephemeral: true});

	const station = interaction.options.getString('station');
	if (station === session.station) return interaction.reply({content: 'The ' + STATIONS[station] + ' station is already playing.', ephemeral: true});
	if (!listSongs(station).length) return interaction.reply({content: 'The ' + STATIONS[station] + ' station has no songs.', ephemeral: true});

	setStation(session, station);
	await reply(interaction, session, interaction.user.toString() + ' switched to the ' + STATIONS[station] + ' station.');
};

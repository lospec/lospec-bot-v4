import { STATIONS, listSongs } from '../../util/music-library.js';
import { join, getSession } from '../../util/music-player.js';

export default async (interaction) => {
	const voiceChannel = interaction.member.voice?.channel;
	if (!voiceChannel) return interaction.reply({content: 'Join a voice channel first.', ephemeral: true});

	await interaction.deferReply({ephemeral: true});

	//with no station picked, keep whatever is playing, or start on chill - or
	//the first station that has songs, if chill has none
	const station = interaction.options.getString('station')
		|| (getSession(interaction.guildId) ? null : ['chill', ...Object.keys(STATIONS)].find(slug => listSongs(slug).length) || 'chill');
	const session = await join(voiceChannel, station);
	await interaction.editReply({content: 'Playing the ' + STATIONS[session.station] + ' station in ' + voiceChannel.toString() + '.'});
};

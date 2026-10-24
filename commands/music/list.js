import { AttachmentBuilder } from 'discord.js';
import { STATIONS, listSongs, loadLibrary, findStation } from '../../util/music-library.js';

// Sent as a file because a station is far longer than a message can hold, and
// discord shows a text file as a small preview that opens to scroll through
export default async (interaction) => {
	await loadLibrary();
	const typed = interaction.options.getString('station');
	const picked = findStation(typed);
	if (typed && !picked) return interaction.reply({content: 'Pick a station from the suggestions.', ephemeral: true});
	const stations = picked ? [picked] : Object.keys(STATIONS);

	const sections = stations.map(station => {
		const songs = listSongs(station);
		return STATIONS[station] + ' station (' + songs.length + ' songs)\n\n' + songs.map(song => song.name).join('\n');
	});
	const file = new AttachmentBuilder(Buffer.from(sections.join('\n\n\n') + '\n'), {
		name: (picked ? picked + '-station' : 'music-stations') + '.txt',
	});

	const count = stations.reduce((total, station) => total + listSongs(station).length, 0);
	await interaction.reply({
		content: (picked ? 'The ' + STATIONS[picked] + ' station has ' : 'The stations have ') + count + ' songs.',
		files: [file],
		ephemeral: true,
	});
};

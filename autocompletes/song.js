import { searchSongs, STATIONS } from '../util/music-library.js';

export default async function (interaction) {
	const focused = interaction.options.getFocused();
	return searchSongs(focused).slice(0, 25).map(song => ({
		name: (STATIONS[song.station] + ' · ' + song.name).slice(0, 100),
		value: song.id,
	}));
}

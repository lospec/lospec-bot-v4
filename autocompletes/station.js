import { STATIONS, listSongs, loadLibrary } from '../util/music-library.js';

export default async function (interaction) {
	await loadLibrary();
	const typed = interaction.options.getFocused().toLowerCase();
	return Object.entries(STATIONS)
		.filter(([slug, name]) => name.toLowerCase().includes(typed) || slug.includes(typed))
		.map(([slug, name]) => ({name: name + ' (' + listSongs(slug).length + ' songs)', value: slug}));
}

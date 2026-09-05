// Suggests LFTs for the `lft` option. Commands that act on your own
// collection only offer the ones you actually own.
import * as store from '../util/lft-store.js';

const OWNED_ONLY = ['auction', 'give'];

export default async function lftAutocomplete (interaction) {
	const focused = interaction.options.getFocused().toLowerCase().replace(/^#/, '');
	const subcommand = interaction.options.getSubcommand(false);

	let lfts;

	if (OWNED_ONLY.includes(subcommand)) {
		lfts = store.getInventory(interaction.user.id)
			.map(row => store.getLftByNumber(row.lftNumber))
			.filter(Boolean)
			//one that is already at auction cannot be auctioned or given away
			.filter(lft => !store.getOpenAuctionForLft(lft.number));
	}
	else lfts = store.getAllLfts();

	const matches = lfts.filter(lft =>
		!focused
		|| lft.name.includes(focused)
		|| lft.title.toLowerCase().includes(focused)
		|| String(lft.number).startsWith(focused));

	return matches
		.sort((a, b) => a.number - b.number)
		.slice(0, 25)
		.map(lft => ({name: '#' + lft.number + ' ' + lft.title, value: String(lft.number)}));
}

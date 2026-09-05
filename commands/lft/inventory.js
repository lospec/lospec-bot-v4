import client from '../../client.js';
import * as store from '../../util/lft-store.js';
import { lftConfig } from '../../util/lft.js';
import { emojiTag } from '../../util/lft-emoji.js';

// A collection is nothing but its emoji. Discord only draws custom emoji big
// when a message holds emoji and whitespace alone - a heading, a caption, one
// stray word, and the lot shrinks to inline size - so anything else worth
// saying goes on the buttons underneath instead, which belong to the message
// and do not disturb its content.

const CONTENT_LIMIT = 2000;

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});
	await interaction.editReply(buildPage(interaction.user.id, 0));
};


//pages are addressed entirely by the button id, so they keep working after a
//restart rather than going dead
client.on('interactionCreate', async interaction => {
	if (!interaction.isButton?.()) return;
	if (!interaction.customId.startsWith('lft_inv_')) return;

	try {
		const [, , userId, page] = interaction.customId.split('_');
		//the message is only ever shown to its owner, but there is no reason to
		//rebuild somebody else's collection if that ever changes
		if (userId !== interaction.user.id) return interaction.deferUpdate();

		await interaction.update(buildPage(userId, Number(page)));
	}
	catch (err) {
		console.error('LFT inventory paging failed', err);
	}
});


export function gridShape () {
	const columns = Math.max(1, Number(lftConfig('inventoryColumns')) || 6);
	const rows = Math.max(1, Number(lftConfig('inventoryRows')) || 4);

	return {columns, rows};
}


// How many fit in one message. 2000 characters is about 58 emoji, and discord
// also stops drawing them big past a certain count, which is what the page
// size is really tuned to.
export function pageSizeFor (lfts, {columns, rows}) {
	const longest = lfts.reduce((max, lft) => Math.max(max, emojiTag(lft).length), 0) + 1;
	if (longest <= 1) return columns * rows;

	const wholeRows = Math.max(1, Math.floor(Math.floor(CONTENT_LIMIT / longest) / columns));
	return Math.max(1, Math.min(columns * rows, wholeRows * columns));
}


export function emojiRows (lfts, columns) {
	const rows = [];
	for (let i = 0; i < lfts.length; i += columns) rows.push(lfts.slice(i, i + columns).map(emojiTag).join(' '));
	return rows.join('\n');
}


function buildPage (userId, page) {
	const shape = gridShape();

	const owned = store.getInventory(userId)
		.map(row => store.getLftByNumber(row.lftNumber))
		.filter(Boolean)
		.sort((a, b) => a.number - b.number);

	//nothing to shrink when there are no emoji, so this one can have words
	if (!owned.length) return {
		content: 'You do not own any LFTs yet. Win one in the marketplace — `/lft help` explains how.',
		components: [],
	};

	//worked out from the whole collection, so it is the same on every page and
	//the page arithmetic stays consistent
	const perPage = pageSizeFor(owned, shape);
	const pages = Math.max(1, Math.ceil(owned.length / perPage));
	page = Math.min(Math.max(0, page), pages - 1);

	const shown = owned.slice(page * perPage, page * perPage + perPage);

	return {
		content: emojiRows(shown, shape.columns),
		components: pages > 1 ? [pagerRow(userId, page, pages)] : [],
	};
}


//the page count lives on a dead button, because putting it in the message
//would stop the emoji being drawn big
function pagerRow (userId, page, pages) {
	return {
		type: 1,
		components: [
			{type: 2, style: 2, label: '◀', customId: 'lft_inv_' + userId + '_' + (page - 1), disabled: page === 0},
			{type: 2, style: 2, label: (page + 1) + ' / ' + pages, customId: 'lft_page_indicator', disabled: true},
			{type: 2, style: 2, label: '▶', customId: 'lft_inv_' + userId + '_' + (page + 1), disabled: page >= pages - 1},
		],
	};
}

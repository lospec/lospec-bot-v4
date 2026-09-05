import { AttachmentBuilder } from 'discord.js';
import * as store from '../../util/lft-store.js';
import { findLft } from '../../util/lft.js';
import { emojiTag } from '../../util/lft-emoji.js';
import { renderPreview, previewFileName } from '../../util/lft-preview.js';

export default async (interaction) => {
	const isPublic = interaction.options.getBoolean('public') || false;
	await interaction.deferReply({ephemeral: !isPublic});

	const lft = findLft(interaction.options.getString('lft'));
	if (!lft) return interaction.editReply({content: 'No LFT by that name or number exists.'});

	const owners = store.getOwners(lft.number);
	const auction = store.getOpenAuctionForLft(lft.number);
	const preview = await renderPreview(lft);

	const fields = [
		{name: 'Number', value: '#' + lft.number, inline: true},
		{name: 'Artwork', value: lft.sourceSize + 'x' + lft.sourceSize + ', ' + lft.colors + ' colors', inline: true},
		{name: 'Minted', value: '<t:' + Math.floor(new Date(lft.createdAt).getTime() / 1000) + ':D>', inline: true},
		{name: 'Creator', value: lft.creatorId ? '<@' + lft.creatorId + '>' : 'The Lozpekistan Treasury', inline: true},
		{name: 'Owner' + (owners.length === 1 ? '' : 's'), value: owners.length ? owners.map(owner => '<@' + owner.userId + '>').join(', ') : 'nobody', inline: true},
	];

	if (auction) fields.push({
		name: 'At Auction',
		value: 'Auction #' + auction.id + ', ends <t:' + Math.floor(new Date(auction.endsAt).getTime() / 1000) + ':R>',
		inline: true,
	});

	await interaction.editReply({
		embeds: [{
			title: 'LFT #' + lft.number + ' · ' + lft.title,
			description: emojiTag(lft) + ' `:' + (lft.emojiName || lft.name) + ':`',
			color: 0xffb300,
			image: {url: 'attachment://' + previewFileName(lft)},
			fields,
		}],
		files: [new AttachmentBuilder(preview, {name: previewFileName(lft)})],
	});
};

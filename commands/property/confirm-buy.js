import { PROPERTY_DATA } from '../../data.js';
import { takeUsersMoney, getUserBalance } from '../../util/lozpekistan-bank.js';
import { drawAllPropertiesImage, drawSinglePropertyImageBuffer } from '../../util/property-draw.js';
import { PROPERTY_CONFIG } from '../../data.js';
import { AttachmentBuilder } from 'discord.js';
import client from '../../client.js';

function getBuyPrice(properties) {
	const numUsers = Object.keys(properties).length;
	return Math.min(Math.ceil((numUsers+1)/10), 10);
}

export default async function confirmPropertyBuy(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	const userId = interaction.user.id;
	if (properties[userId]) {
		await interaction.update({content: 'You already own a property!', components: []});
		return;
	}
	const price = getBuyPrice(properties);
	try {
		await takeUsersMoney(userId, price);
	} catch (err) {
		const balance = await getUserBalance(userId).catch(() => null);
		await interaction.update({
			content: `You do not have enough money to complete this purchase.\nYour current balance: ${balance !== null ? balance + 'P' : 'unknown'}\n(${err.message || err})`,
			components: [],
			ephemeral: true
		});
		return;
	}
	properties[userId] = {width: 1, height: 1};
	PROPERTY_DATA.set('properties', properties);

	// Draw and send the updated images
	const imgBuffer = await drawAllPropertiesImage(properties);
	const singleBuffer = await drawSinglePropertyImageBuffer(1, 1, 'Cabin');
	const channel = await client.channels.fetch(PROPERTY_CONFIG.get('propertyUpdatesChannelId'));
	await channel.send({
		content: `<@${userId}> purchased a property!`,
		files: [new AttachmentBuilder(imgBuffer, {name: 'properties.png'})]
	});

	await interaction.update({
		content: 'Property purchased! Your house is now 1x1.',
		components: [],
		files: [new AttachmentBuilder(singleBuffer, {name: 'property.png'})],
		ephemeral: true
	});
}

client.on('interactionCreate', async interaction => {
	if (interaction.isButton() && interaction.customId === 'property_confirm_buy') {
		return await confirmPropertyBuy(interaction);
	}
});

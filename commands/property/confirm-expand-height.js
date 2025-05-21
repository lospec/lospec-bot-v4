import { PROPERTY_DATA, PROPERTY_CONFIG } from '../../data.js';
import { takeUsersMoney, getUserBalance } from '../../util/lozpekistan-bank.js';
import { drawAllPropertiesImage, drawSinglePropertyImageBuffer } from '../../util/property-draw.js';
import { getExpandHeightBill } from '../../util/property-bill.js';
import { AttachmentBuilder } from 'discord.js';
import client from '../../client.js';

export default async function confirmExpandHeight(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	const userId = interaction.user.id;
	let userProperty = properties[userId];
	if (!userProperty) {
		await interaction.update({content: 'You do not own a property yet.', components: []});
		return;
	}
	const bill = getExpandHeightBill(userProperty);
	try {
		await takeUsersMoney(userId, bill.total);
	} catch (err) {
		const balance = await getUserBalance(userId).catch(() => null);
		await interaction.update({
			content: `You do not have enough money to complete this purchase.\nYour current balance: ${balance !== null ? balance + 'P' : 'unknown'}\n(${err.message || err})`,
			components: [],
			ephemeral: true
		});
		return;
	}
	userProperty.height = (userProperty.height || 1) + 1;
	// Ensure style is preserved
	userProperty.style = userProperty.style || 'Cabin';
	PROPERTY_DATA.set('properties', properties);

	// Draw and send the updated images
	const imgBuffer = await drawAllPropertiesImage(properties);
	const singleBuffer = await drawSinglePropertyImageBuffer(userProperty.width, userProperty.height, userProperty.style);
	await interaction.update({
		content: `Your expansion is now complete! Your house is now ${userProperty.width}x${userProperty.height}.`,
		components: [],
		files: [new AttachmentBuilder(singleBuffer, {name: 'property.png'})],
		ephemeral: true
	});
	const channel = await client.channels.fetch(PROPERTY_CONFIG.get('propertyUpdatesChannelId'));
	await channel.send({
		content: `🏠 <@${userId}> expanded their house height to ${userProperty.height}`,
		files: [new AttachmentBuilder(imgBuffer, {name: 'properties.png'})]
	});
}

client.on('interactionCreate', async interaction => {
	if (interaction.isButton() && interaction.customId === 'property_confirm_expand-height') {
		return await confirmExpandHeight(interaction);
	}
});

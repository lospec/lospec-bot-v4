import { PROPERTY_DATA, PROPERTY_CONFIG } from '../../data.js';
import { PROPERTY_STYLES } from '../../util/property-styles.js';
import { getUserBalance, takeUsersMoney } from '../../util/lozpekistan-bank.js';
import { drawAllPropertiesImage, drawSinglePropertyImageBuffer } from '../../util/property-draw.js';
import { AttachmentBuilder } from 'discord.js';
import client from '../../client.js';
import { getChangeStyleBill } from '../../util/property-bill.js';

function getStyleByName(name) {
	return PROPERTY_STYLES.find(s => s.name.toLowerCase() === name.toLowerCase());
}

export default async function(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	const userId = interaction.user.id;
	let userProperty = properties[userId];
	if (!userProperty) {
		await interaction.reply({content: 'You do not own a property yet. Use /property buy first!', ephemeral: true});
		return;
	}
	const styleOptions = PROPERTY_STYLES.map(s => ({
		label: `${s.name} ($${s.cost} / Tile)` ,
		value: s.name.toLowerCase(),
		description: s.description
	}));
	if (!interaction.isStringSelectMenu()) {
		await interaction.reply({
			content: 'Select a new style for your house:',
			components: [{
				type: 1,
				components: [{
					type: 3,
					customId: 'property_change_style_select',
					options: styleOptions,
					placeholder: 'Choose a style...'
				}]
			}],
			ephemeral: true
		});
		return;
	}
	const newStyleName = interaction.values[0];
	const newStyle = getStyleByName(newStyleName);
	if (!newStyle) {
		await interaction.update({content: 'Invalid style selected.', components: [], ephemeral: true});
		return;
	}
	if (userProperty.style && userProperty.style.toLowerCase() === newStyle.name.toLowerCase()) {
		await interaction.update({content: 'Your house is already this style.', components: [], ephemeral: true});
		return;
	}
	const bill = getChangeStyleBill(userProperty, newStyle);
	let balance = await getUserBalance(userId).catch(() => null);
	if (balance !== null && balance < bill.total) {
		await interaction.update({
			content: `You do not have enough money to perform this renovation.\nYour current balance: ${balance}P\nRequired: ${bill.total}P\n\n${billText}`,
			components: [],
			ephemeral: true
		});
		return;
	}
	const confirmMsg = `Changing your house style to ${newStyle.name} will cost **$${bill.total}**.\n${bill.invoice}\nAre you sure?`;
	const confirmationActionRow = {
		type: 1,
		components: [
			{ type: 2, style: 1, label: 'Confirm', customId: 'property_confirm_change-style' },
			{ type: 2, style: 2, label: 'Cancel', customId: 'property_cancel' }
		]
	};
	// Store the selected style in a hidden field for confirmation
	await interaction.update({content: confirmMsg, components: [confirmationActionRow], ephemeral: true, embeds: [], files: [],
		// Use message metadata or a custom property if your framework supports it
		// Otherwise, you may need to store this in a temporary cache or database
	});
}

// Handler for when user selects a new style from the select menu
export async function handleStyleSelect(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	const userId = interaction.user.id;
	let userProperty = properties[userId];
	if (!userProperty) {
		await interaction.update({content: 'You do not own a property yet. Use /property buy first!', components: [], ephemeral: true});
		return;
	}
	const newStyleName = interaction.values[0];
	const newStyle = getStyleByName(newStyleName);
	if (!newStyle) {
		await interaction.update({content: 'Invalid style selected.', components: [], ephemeral: true});
		return;
	}
	if (userProperty.style && userProperty.style.toLowerCase() === newStyle.name.toLowerCase()) {
		await interaction.update({content: 'Your house is already this style.', components: [], ephemeral: true});
		return;
	}
	const bill = getChangeStyleBill(userProperty, newStyle);
	let balance = await getUserBalance(userId).catch(() => null);
	if (balance !== null && balance < bill.total) {
		await interaction.update({
			content: `You do not have enough money to perform this renovation.\nYour current balance: ${balance}P\nRequired: ${bill.total}P\n\n${bill.invoice}`,
			components: [],
			ephemeral: true
		});
		return;
	}
	const confirmMsg = `Changing your house style to ${newStyle.name} will cost **$${bill.total}**.\n${bill.invoice}\nAre you sure?`;
	const confirmationActionRow = {
		type: 1,
		components: [
			{ type: 2, style: 1, label: 'Confirm', customId: 'property_confirm_change-style' },
			{ type: 2, style: 2, label: 'Cancel', customId: 'property_cancel' }
		]
	};
	// Store the selected style in a hidden field for confirmation
	await interaction.update({content: confirmMsg, components: [confirmationActionRow], ephemeral: true, embeds: [], files: [],
		// Use message metadata or a custom property if your framework supports it
		// Otherwise, you may need to store this in a temporary cache or database
	});
}

// Handler for when user confirms the style change
export async function handleConfirmChangeStyle(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	const userId = interaction.user.id;
	let userProperty = properties[userId];
	if (!userProperty) {
		await interaction.update({content: 'You do not own a property yet. Use /property buy first!', components: [], ephemeral: true});
		return;
	}
	// Try to get the style from a temporary property on the userProperty object
	let newStyleName = userProperty.pendingStyle;
	if (!newStyleName && interaction.message && interaction.message.content) {
		// Try to parse the style name from the confirmation message
		const match = interaction.message.content.match(/house style to ([^\s]+) will cost/i);
		if (match) newStyleName = match[1];
	}
	if (!newStyleName) {
		await interaction.update({content: 'Could not determine the selected style. Please try again.', components: [], ephemeral: true});
		return;
	}
	const newStyle = getStyleByName(newStyleName);
	if (!newStyle) {
		await interaction.update({content: 'Invalid style selected.', components: [], ephemeral: true});
		return;
	}
	const bill = getChangeStyleBill(userProperty, newStyle);
	let balance = await getUserBalance(userId).catch(() => null);
	if (balance !== null && balance < bill.total) {
		await interaction.update({
			content: `You do not have enough money to change styles.\nYour current balance: ${balance}P\nRequired: ${bill.total}P`,
			components: [],
			ephemeral: true
		});
		return;
	}
	try {
		await takeUsersMoney(userId, bill.total);
	} catch (err) {
		await interaction.update({content: `Transaction failed: ${err.message || err}`, components: [], ephemeral: true});
		return;
	}
	userProperty.style = newStyle.name;
	delete userProperty.pendingStyle;
	PROPERTY_DATA.set('properties', properties);
	const imgBuffer = await drawAllPropertiesImage(properties);
	const singleBuffer = await drawSinglePropertyImageBuffer(userProperty.width, userProperty.height, userProperty.style);
	await interaction.update({
		content: `Your house style has been changed to **${newStyle.name}**!`,
		components: [],
		files: [new AttachmentBuilder(singleBuffer, {name: 'property.png'})],
		ephemeral: true
	});
	const channelId = PROPERTY_CONFIG.get ? PROPERTY_CONFIG.get('propertyUpdatesChannelId') : PROPERTY_DATA.get('propertyUpdatesChannelId');
	if (channelId) {
		const channel = await client.channels.fetch(channelId).catch(() => null);
		if (channel) {
			await channel.send({
				content: `🏠 <@${userId}> changed their house style to **${newStyle.name}**!`,
				files: [new AttachmentBuilder(imgBuffer, {name: 'properties.png'})]
			});
		}
	}
}

// Handler for style select menu and confirmation button
export async function handlePropertyInteraction(interaction) {
	if (interaction.isStringSelectMenu() && interaction.customId === 'property_change_style_select') {
		await handleStyleSelect(interaction);
		return;
	}
	if (interaction.isButton() && interaction.customId === 'property_confirm_change-style') {
		await handleConfirmChangeStyle(interaction);
		return;
	}
}

// Register property style select and confirm button listeners
client.on('interactionCreate', async interaction => {
	if (
		(interaction.isStringSelectMenu() && interaction.customId === 'property_change_style_select') ||
		(interaction.isButton() && interaction.customId === 'property_confirm_change-style')
	) {
		await handlePropertyInteraction(interaction);
	}
});

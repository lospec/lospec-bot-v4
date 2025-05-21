import { PROPERTY_DATA } from '../../data.js';
import { PROPERTY_ACCENTS } from '../../util/property-styles.js';
import { getUserBalance, takeUsersMoney } from '../../util/lozpekistan-bank.js';
import { drawAllPropertiesImage, drawSinglePropertyImageBuffer } from '../../util/property-draw.js';
import { AttachmentBuilder } from 'discord.js';
import { getChangeAccentBill } from '../../util/property-bill.js';

function getAccentByName(name) {
	return PROPERTY_ACCENTS[name.toLowerCase()];
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
	const accentOptions = Object.keys(PROPERTY_ACCENTS).map(a => ({
		label: a.charAt(0).toUpperCase() + a.slice(1),
		value: a,
		description: PROPERTY_ACCENTS[a].join(', ')
	}));
	if (!interaction.isStringSelectMenu()) {
		await interaction.reply({
			content: 'Select a new accent color for your house:',
			components: [{
				type: 1,
				components: [{
					type: 3,
					customId: 'property_change_accent_select',
					options: accentOptions,
					placeholder: 'Choose an accent color...'
				}]
			}],
			ephemeral: true
		});
		return;
	}
	const newAccent = interaction.values[0];
	if (userProperty.accent && userProperty.accent.toLowerCase() === newAccent.toLowerCase()) {
		await interaction.update({content: 'Your house already uses this accent color.', components: [], ephemeral: true});
		return;
	}
	const bill = getChangeAccentBill(userProperty, newAccent);
	let balance = await getUserBalance(userId).catch(() => null);
	if (balance !== null && balance < bill.total) {
		await interaction.update({
			content: `You do not have enough money to change accent color.\nYour current balance: ${balance}P\nRequired: ${bill.total}P\n\n${bill.invoice}`,
			components: [],
			ephemeral: true
		});
		return;
	}
	const confirmMsg = `Changing your house accent color to ${newAccent} will cost **$${bill.total}**.\n${bill.invoice}\nAre you sure?`;
	const confirmationActionRow = {
		type: 1,
		components: [
			{ type: 2, style: 1, label: 'Confirm', customId: 'property_confirm_change-accent' },
			{ type: 2, style: 2, label: 'Cancel', customId: 'property_cancel' }
		]
	};
	userProperty.pendingAccent = newAccent;
	// Do NOT set userProperty.accent or update the main accent here!
	properties[userId] = userProperty;
	PROPERTY_DATA.set('properties', properties);
	await interaction.update({content: confirmMsg, components: [confirmationActionRow], ephemeral: true});
}

async function handleConfirmChangeAccent(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	const userId = interaction.user.id;
	let userProperty = properties[userId];
	if (!userProperty) {
		await interaction.update({content: 'You do not own a property yet. Use /property buy first!', components: [], ephemeral: true});
		return;
	}
	let newAccent = userProperty.pendingAccent;
	if (!newAccent && interaction.message && interaction.message.content) {
		const match = interaction.message.content.match(/accent color to ([^\s]+) will cost/i);
		if (match) newAccent = match[1];
	}
	if (!newAccent) {
		await interaction.update({content: 'Could not determine the selected accent color. Please try again.', components: [], ephemeral: true});
		return;
	}
	const bill = getChangeAccentBill(userProperty, newAccent);
	let balance = await getUserBalance(userId).catch(() => null);
	if (balance !== null && balance < bill.total) {
		await interaction.update({
			content: `You do not have enough money to change accent color.\nYour current balance: ${balance}P\nRequired: ${bill.total}P`,
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
	userProperty.accent = newAccent;
	delete userProperty.pendingAccent;
	properties[userId] = userProperty;
	PROPERTY_DATA.set('properties', properties);
	const imgBuffer = await drawAllPropertiesImage(properties);
	const singleBuffer = await drawSinglePropertyImageBuffer(userProperty.width, userProperty.height, userProperty.style, newAccent);
	await interaction.update({
		content: `Your house accent color has been changed to **${newAccent}**!`,
		components: [],
		files: [new AttachmentBuilder(singleBuffer, {name: 'property.png'})],
		ephemeral: true
	});
	const channelId = PROPERTY_DATA.get('propertyUpdatesChannelId');
	if (channelId) {
		const channel = await client.channels.fetch(channelId).catch(() => null);
		if (channel) {
			await channel.send({
				content: `<@${userId}> changed their house accent color to **${newAccent}**!`,
				files: [new AttachmentBuilder(imgBuffer, {name: 'properties.png'})]
			});
		}
	}
}

// Handler for accent select menu and confirmation button
import changeAccent from './change-accent.js';
export async function handlePropertyAccentInteraction(interaction) {
	if (interaction.isStringSelectMenu() && interaction.customId === 'property_change_accent_select') {
		await changeAccent(interaction);
		return;
	}
	if (interaction.isButton() && interaction.customId === 'property_confirm_change-accent') {
		await handleConfirmChangeAccent(interaction);
		return;
	}
}

// Register property accent select and confirm button listeners
import client from '../../client.js';
client.on('interactionCreate', async interaction => {
	if (
		(interaction.isStringSelectMenu() && interaction.customId === 'property_change_accent_select') ||
		(interaction.isButton() && interaction.customId === 'property_confirm_change-accent')
	) {
		await handlePropertyAccentInteraction(interaction);
	}
});

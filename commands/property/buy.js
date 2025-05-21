import { PROPERTY_DATA } from '../../data.js';
import { getUserBalance } from '../../util/lozpekistan-bank.js';

function getBuyPrice(properties) {
	const numUsers = Object.keys(properties).length;
	return Math.min(Math.ceil((numUsers+1)/10), 10);
}

export default async function(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	let userProperty = properties[interaction.user.id];
	if (userProperty) {
		await interaction.reply({content: 'You already own a property!', ephemeral: true});
		return;
	}
	const price = getBuyPrice(properties);
	let balance = await getUserBalance(interaction.user.id).catch(() => null);
	if (balance !== null && balance < price) {
		await interaction.reply({
			content: `You do not have enough money to buy a property.\nYour current balance: ${balance}P\nRequired: ${price}P`,
			ephemeral: true
		});
		return;
	}
	const confirmMsg = `Buying a lot will cost **$${price}**. Are you sure?`;
	const confirmationActionRow = {
		type: 1,
		components: [
			{ type: 2, style: 1, label: 'Confirm', customId: 'property_confirm_buy' },
			{ type: 2, style: 2, label: 'Cancel', customId: 'property_cancel' }
		]
	};
	await interaction.reply({content: confirmMsg, components: [confirmationActionRow], ephemeral: true});
}

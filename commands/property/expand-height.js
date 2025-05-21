import { PROPERTY_DATA } from '../../data.js';
import { getExpandHeightBill } from '../../util/property-bill.js';
import { getUserBalance } from '../../util/lozpekistan-bank.js';

export default async function(interaction) {
	await PROPERTY_DATA.assert('properties', false);
	let properties = PROPERTY_DATA.get('properties') || {};
	let userProperty = properties[interaction.user.id];
	if (!userProperty) {
		await interaction.reply({content: 'You do not own a property yet. Use /property buy first!', ephemeral: true});
		return;
	}
	const { total: price, billLines } = getExpandHeightBill(userProperty);
	const invoice = [
		'```',
		'HOME EXPANSION INVOICE',
		...billLines.map(l => l.toUpperCase()),
		'--------------------------',
		`TOTAL: $${price}`,
		'```'
	].join('\n');
	let balance = await getUserBalance(interaction.user.id).catch(() => null);
	if (balance !== null && balance < price) {
		await interaction.reply({
			content: `You do not have enough money to purchase this expansion.\nYour current balance: ${balance}P\nRequired: ${price}P\n${invoice}`,
			components: [],
			ephemeral: true
		});
		return;
	}
	const confirmMsg = `Expanding your house height will cost **$${price}**.\n${invoice}\nAre you sure?`;
	const confirmationActionRow = {
		type: 1,
		components: [
			{ type: 2, style: 1, label: 'Confirm', customId: 'property_confirm_expand-height' },
			{ type: 2, style: 2, label: 'Cancel', customId: 'property_cancel' }
		]
	};
	await interaction.reply({content: confirmMsg, components: [confirmationActionRow], ephemeral: true});
}

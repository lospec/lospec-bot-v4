import { PROPERTY_DATA } from '../../data.js';
import { getUserBalance } from '../../util/lozpekistan-bank.js';
import { getSellPropertyBill } from '../../util/property-bill.js';
import { AttachmentBuilder } from 'discord.js';
import { drawSinglePropertyImageBuffer } from '../../util/property-draw.js';

export default async function(interaction) {
    await PROPERTY_DATA.assert('properties', false);
    let properties = PROPERTY_DATA.get('properties') || {};
    const userId = interaction.user.id;
    let userProperty = properties[userId];
    if (!userProperty) {
        await interaction.reply({content: 'You do not own a property to sell.', ephemeral: true});
        return;
    }
    const bill = getSellPropertyBill(userProperty);
    const buffer = await drawSinglePropertyImageBuffer(userProperty.width, userProperty.height, userProperty.style, userProperty.accent);
    const confirmMsg = `Selling your property will give you **$${bill.total}** back.\n${bill.invoice}\nAre you sure? This cannot be undone.`;
    const confirmationActionRow = {
        type: 1,
        components: [
            { type: 2, style: 1, label: 'Confirm', customId: 'property_confirm_sell' },
            { type: 2, style: 2, label: 'Cancel', customId: 'property_cancel' }
        ]
    };
    userProperty.pendingSale = true;
    properties[userId] = userProperty;
    PROPERTY_DATA.set('properties', properties);
    await interaction.reply({content: confirmMsg, components: [confirmationActionRow], files: [new AttachmentBuilder(buffer, {name: 'property.png'})], ephemeral: true});
}

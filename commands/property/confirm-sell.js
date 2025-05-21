import { PROPERTY_DATA, PROPERTY_CONFIG } from '../../data.js';
import { getSellPropertyBill } from '../../util/property-bill.js';
import { AttachmentBuilder } from 'discord.js';
import { drawAllPropertiesImage } from '../../util/property-draw.js';
import { giveUserMoney } from '../../util/lozpekistan-bank.js';
import client from '../../client.js';

export default async function confirmSell(interaction) {
    await PROPERTY_DATA.assert('properties', false);
    let properties = PROPERTY_DATA.get('properties') || {};
    const userId = interaction.user.id;
    let userProperty = properties[userId];
    if (!userProperty || !userProperty.pendingSale) {
        await interaction.update({content: 'No property sale pending.', components: []});
        return;
    }
    const bill = getSellPropertyBill(userProperty);
    // Remove property
    delete properties[userId];
    PROPERTY_DATA.set('properties', properties);
    // Give user refund
    if (bill.total > 0) {
        await giveUserMoney(userId, bill.total);
    }
    // Update property image for channel
    const imgBuffer = await drawAllPropertiesImage(properties);
    const channel = await client.channels.fetch(PROPERTY_CONFIG.get('propertyUpdatesChannelId'));
    await channel.send({
        content: `<@${userId}> sold their property!`,
        files: [new AttachmentBuilder(imgBuffer, {name: 'properties.png'})]
    });
    await interaction.update({
        content: `You have sold your property! You received **$${bill.total}**.\nYou can buy a new property at any time.`,
        components: [],
        ephemeral: true
    });
}

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId === 'property_confirm_sell') {
        return await confirmSell(interaction);
    }
});

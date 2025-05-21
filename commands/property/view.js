import { PROPERTY_DATA } from '../../data.js';
import { drawSinglePropertyImageBuffer } from '../../util/property-draw.js';
import { AttachmentBuilder } from 'discord.js';

export default async function view(interaction) {
    await PROPERTY_DATA.assert('properties', false);
    const properties = PROPERTY_DATA.get('properties') || {};
    const userId = interaction.user.id;
    const userProperty = properties[userId];
    if (!userProperty) {
        await interaction.reply({content: 'You do not own a property yet. Use /property buy first!', ephemeral: true});
        return;
    }
    // Draw just the user's house with margin and ground
    const buffer = await drawSinglePropertyImageBuffer(userProperty.width, userProperty.height, userProperty.style, userProperty.accent);
    await interaction.reply({
        content: `Here is your property (${userProperty.width}x${userProperty.height}):`,
        files: [new AttachmentBuilder(buffer, {name: 'property.png'})],
        ephemeral: true
    });
}

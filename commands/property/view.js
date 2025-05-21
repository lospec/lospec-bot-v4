import { PROPERTY_DATA } from '../../data.js';
import { loadTilesPng, drawSinglePropertyImage } from '../../util/property-draw.js';
import { AttachmentBuilder } from 'discord.js';
import { PNG } from 'pngjs';

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
    const tiles = await loadTilesPng();
    const housePng = drawSinglePropertyImage(tiles, userProperty.width, userProperty.height);
    if (!housePng) {
        await interaction.reply({content: 'Failed to render your property.', ephemeral: true});
        return;
    }
    const buffer = PNG.sync.write(housePng);
    await interaction.reply({
        content: `Here is your property (${userProperty.width}x${userProperty.height}):`,
        files: [new AttachmentBuilder(buffer, {name: 'property.png'})],
        ephemeral: true
    });
}

import { ApplicationCommandType, EmbedBuilder } from 'discord.js';

export const config = {
    name: 'help',
    description: 'Show help for emoji commands and how to submit new emojis',
    type: ApplicationCommandType.ChatInput,
};

export default async (interaction) => {
    const helpEmbed = new EmbedBuilder()
        .setTitle('Lospec Emoji Bot Help')
        .setDescription(
            '**Emoji Commands:**\n' +
            '• `/emoji add <emoji>` — Add an emoji from the Lospec Emoji Archive to the server.\n' +
            '• `/emoji remove <emoji>` — Remove an emoji from this server.\n' +
            '• `/emoji update <emoji>` — Update an emoji on this server to the newest version from the archive.\n' +
            '• `/emoji info <emoji>` — Get information about an emoji.\n' +
            '• `/emoji help` — Show this help message.\n\n' +
            '_Adding, removing and updating emojis on this server costs Pikzels (our virtual currency, use `/bankcustomerservice` for more info)_\n\n' +
            '**How to Submit New Emojis to the Archive:**\n' +
            '1. Fork and clone the emoji archive GitHub repo.\n' +
            '2. Add your PNG image (16x16, transparent, Lospec Emoji Palette) to the "current" folder in the emoji archive.\n' +
            '3. Update `credits.csv` with the emoji name, version, author, date, and category.\n' +
            '4. Submit a pull request and your submission will be validated (if it fails, you\'ll have to fix it before it can be added).\n' +
			'5. Wait for your emoji to be added to the archive. Once it is, you can use the `/emoji add <emoji>` command to add it to the server.\n\n' +
            'For full details, see the emoji archive README: <https://github.com/lospec/emoji-archive>'
        )
        .setColor(0xF5A623);

    await interaction.reply({
        embeds: [helpEmbed],
        ephemeral: true
    });
};

// Suggests emoji names for autocomplete in emoji commands
import fs from 'fs';
import path from 'path';

const EMOJI_DIR = path.join('_emoji-archive', 'current');

export default async function emojiNameAutocomplete(interaction) {
    const focused = interaction.options.getFocused();
    let emojiNames = [];
    try {
        emojiNames = fs.readdirSync(EMOJI_DIR)
            .filter(f => f.endsWith('.png'))
            .map(f => f.replace(/\.png$/, ''));
    } catch (e) {}
    const lower = focused.toLowerCase();
    const startsWith = emojiNames.filter(name => name.toLowerCase().startsWith(lower));
    const contains = emojiNames.filter(name => !name.toLowerCase().startsWith(lower) && name.toLowerCase().includes(lower));
    const ordered = startsWith.concat(contains);
    return ordered;
}

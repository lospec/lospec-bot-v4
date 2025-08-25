import { ApplicationCommandType, ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { DEXELAR_DATA } from '../data.js';

export const config = {
    name: 'dexelar-add-codes',
    description: 'Admin: Add codes to a Dexelar pack',
    default_member_permissions: (PermissionFlagsBits.ManageGuild).toString(),
    dm_permission: false,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'pack',
            description: 'Pack name to add codes to',
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true
        },
        {
            name: 'codes',
            description: 'Comma-separated list of codes',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
};

export const execute = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const packName = interaction.options.getString('pack');
    const codesInput = interaction.options.getString('codes');
    const codes = codesInput.split(',').map(c => c.trim()).filter(Boolean);
    if (codes.length === 0) return interaction.editReply({ content: 'No valid codes provided.' });

    let packs = DEXELAR_DATA.get('packs') || {};
    if (!packs[packName]) return interaction.editReply({ content: 'Pack not found.' });
    if (!Array.isArray(packs[packName].codes)) packs[packName].codes = [];

    packs[packName].codes.push(...codes);
    await DEXELAR_DATA.set('packs', packs);

    interaction.editReply({ content: 'Added '+codes.length+' codes to pack "'+packName+'".' });
};

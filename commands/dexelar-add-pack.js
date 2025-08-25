import { ApplicationCommandType, ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { DEXELAR_DATA } from '../data.js';

export const config = {
    name: 'dexelar-add-pack',
    description: 'Admin: Add a new Dexelar pack',
    default_member_permissions: (PermissionFlagsBits.ManageGuild).toString(),
    dm_permission: false,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'name',
            description: 'Pack name',
            type: ApplicationCommandOptionType.String,
            required: true
        },
        {
            name: 'packid',
            description: 'Pack Id (string)',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ]
};

export const execute = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name');
    const packId = interaction.options.getString('packid');

    let packs = DEXELAR_DATA.get('packs') || {};
    if (packs[name]) return interaction.editReply({ content: 'A pack with that name already exists.' });

    packs[name] = { id: packId, codes: [] };
    await DEXELAR_DATA.set('packs', packs);

    interaction.editReply({ content: 'Pack "'+name+'" added with Pack Id "'+packId+'".' });
};

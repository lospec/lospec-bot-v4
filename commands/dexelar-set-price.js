import { ApplicationCommandType, ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { DEXELAR_DATA } from '../data.js';

export const config = {
    name: 'dexelar-set-price',
    description: 'Admin: Set the Dexelar code purchase price',
    default_member_permissions: (PermissionFlagsBits.ManageGuild).toString(),
    dm_permission: false,
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'price',
            description: 'New price (P)',
            type: ApplicationCommandOptionType.Integer,
            required: true
        }
    ]
};

export const execute = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const price = interaction.options.getInteger('price');
    if (price < 0) return interaction.editReply({ content: 'Price must be a positive number.' });
    await DEXELAR_DATA.set('purchasePrice', price);
    interaction.editReply({ content: 'Dexelar code purchase price set to '+price+'P.' });
};

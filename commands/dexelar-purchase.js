import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import { DEXELAR_DATA } from '../data.js';
import { checkIfUserCanAfford, takeUsersMoney } from '../util/lozpekistan-bank.js';
import client from '../client.js';

await DEXELAR_DATA.assert('purchasePrice');

export const config = {
    name: 'dexelar-purchase',
    description: 'Purchase a code from a Dexelar pack',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'pack',
            description: 'The name of the pack to purchase from',
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true
        }
    ]
};

export const execute = async (interaction) => {
    const price = DEXELAR_DATA.get('purchasePrice');
    const packName = interaction.options.getString('pack');
    const packs = DEXELAR_DATA.get('packs') || {};
    const pack = packs[packName];
    if (!pack) return interaction.reply({ content: 'Pack not found.', ephemeral: true });
    if (!pack.codes || pack.codes.length === 0) return interaction.reply({ content: 'Sorry, this pack is sold out!', ephemeral: true });

    try {
        await checkIfUserCanAfford(interaction.user.id, price);
    } catch (err) {
        return interaction.reply({ content: err.message, ephemeral: true });
    }

    // Confirmation embed and buttons
    const confirmationActionRow = {
        type: 1,
        components: [
            {
                type: 2,
                style: 1,
                label: 'Confirm Purchase',
                customId: 'dexelar_confirm_purchase'
            },
            {
                type: 2,
                style: 2,
                label: 'Cancel',
                customId: 'dexelar_cancel_purchase'
            }
        ]
    };

    const packId = pack.id || '';
    const embed = {
        title: 'Confirm Dexelar Pack Purchase',
        description: `You are about to purchase a "${packName}" pack of Dexelar cards.\n\nThis will cost you **${price}P**.\n\nAre you sure you wish to do this?`,
        color: 0x00bfff,
        author: { name: packName },
        thumbnail: packId ? { url: `https://dexelar.com/packs/${packId}.png` } : undefined,
    };

    await interaction.reply({
        embeds: [embed],
        components: [confirmationActionRow],
        ephemeral: true
    });
};

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'dexelar_confirm_purchase' && interaction.customId !== 'dexelar_cancel_purchase') return;

    if (interaction.customId === 'dexelar_cancel_purchase') {
        await interaction.update({ content: 'Dexelar pack purchase cancelled.', embeds: [], components: [] });
        return;
    }

    // Confirm purchase
    // Get pack name and price from embed
    const packName = interaction.message.embeds[0].author.name;
    const price = DEXELAR_DATA.get('purchasePrice');
    const packs = DEXELAR_DATA.get('packs') || {};
    const pack = packs[packName];
    if (!pack || !pack.codes || pack.codes.length === 0) {
        await interaction.update({ content: 'Sorry, this pack is sold out!', embeds: [], components: [] });
        return;
    }
    try {
        await checkIfUserCanAfford(interaction.user.id, price);
    } catch (err) {
        await interaction.update({ content: err.message, embeds: [], components: [] });
        return;
    }
    const codeValue = pack.codes.shift();
    try {
        await takeUsersMoney(interaction.user.id, price);
        packs[packName] = pack;
        await DEXELAR_DATA.set('packs', packs);
    } catch (err) {
        await interaction.update({ content: 'Failed to process purchase: '+err.message, embeds: [], components: [] });
        return;
    }
    await interaction.update({
        content: 'You purchased a "'+packName+'" pack of Dexelar cards! \n\nUse this code on the [shop page](<https://dexelar.com/shop>) to redeem your pack!\n`'+codeValue+'`',
        embeds: [],
        components: []
    });
});

import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { CONFIG } from '../data.js';

export const config = new SlashCommandBuilder()
    .setName('forum-flair')
    .setDescription('Configure forum channels for automatic flair selection')
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Add a forum channel to the flair system')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The forum channel to add')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildForum)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove a forum channel from the flair system')
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The forum channel to remove')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildForum)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List all forum channels in the flair system')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export const execute = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    
    const subcommand = interaction.options.getSubcommand();
    
    switch (subcommand) {
        case 'add':
            await addForumChannel(interaction);
            break;
        case 'remove':
            await removeForumChannel(interaction);
            break;
        case 'list':
            await listForumChannels(interaction);
            break;
    }
};

async function addForumChannel(interaction) {
    const channel = interaction.options.getChannel('channel');
    
    if (channel.type !== ChannelType.GuildForum) {
        await interaction.editReply('The specified channel is not a forum channel.');
        return;
    }
    
    const forumFlairChannels = await CONFIG.get('forumFlairChannels') || [];
    
    if (forumFlairChannels.includes(channel.id)) {
        await interaction.editReply(`${channel.name} is already in the forum flair system.`);
        return;
    }
    
    forumFlairChannels.push(channel.id);
    await CONFIG.set('forumFlairChannels', forumFlairChannels);
    
    await interaction.editReply(`✅ Added ${channel.name} to the forum flair system. New threads in this forum will now prompt for flair selection.`);
}

async function removeForumChannel(interaction) {
    const channel = interaction.options.getChannel('channel');
    
    const forumFlairChannels = await CONFIG.get('forumFlairChannels') || [];
    
    if (!forumFlairChannels.includes(channel.id)) {
        await interaction.editReply(`${channel.name} is not in the forum flair system.`);
        return;
    }
    
    const updatedChannels = forumFlairChannels.filter(id => id !== channel.id);
    await CONFIG.set('forumFlairChannels', updatedChannels);
    
    await interaction.editReply(`✅ Removed ${channel.name} from the forum flair system.`);
}

async function listForumChannels(interaction) {
    const forumFlairChannels = await CONFIG.get('forumFlairChannels') || [];
    
    if (forumFlairChannels.length === 0) {
        await interaction.editReply('No forum channels are currently configured for the flair system.');
        return;
    }
    
    const channelList = forumFlairChannels
        .map(id => {
            const channel = interaction.guild.channels.cache.get(id);
            return channel ? `• ${channel.name}` : `• Unknown channel (${id})`;
        })
        .join('\n');
    
    await interaction.editReply(`**Forum channels with flair system enabled:**\n${channelList}`);
}

import { CONFIG } from '../data.js';
import client from '../client.js';
import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType,
    PermissionFlagsBits 
} from 'discord.js';

// Map of flair types to Discord forum tag names
const FLAIR_TAGS = {
    'portfolio': 'Portfolio',
    'paid-job': 'Paid Job',
    'rev-share': 'Revenue Share',
    'collaboration': 'Collaboration',
    'contest': 'Contest',
    'event': 'Event',
    'resource': 'Resource',
    'livestream': 'Livestream',
    'official': 'Official'
};

// Set up interaction handler when client is ready
client.once('ready', () => {
    client.on('interactionCreate', async interaction => {
        if (interaction.isButton() && interaction.customId.startsWith('flair_')) {
            try {
                await handleFlairInteraction(interaction);
            } catch (err) {
                console.error('Flair interaction error:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while processing your selection.', ephemeral: true });
                }
            }
        }
    });
});

export const filter = async (message) => {
    // Only trigger on the first message in a thread
    if (!message.channel.isThread()) return false;
    
    // Only trigger if the parent is a forum channel
    if (message.channel.parent?.type !== ChannelType.GuildForum) return false;
    
    // Only trigger if this is the first message in the thread (the one that creates it)
    if (message.channel.messageCount !== 1) return false;
    
    // Check if this forum channel is configured for flair
    const forumFlairChannels = await CONFIG.get('forumFlairChannels') || [];
    if (forumFlairChannels.length > 0 && !forumFlairChannels.includes(message.channel.parent.id)) return false;
    
    // Only trigger if the message author is the thread owner
    if (message.author.id !== message.channel.ownerId) return false;
    
    return true;
}

export const execute = async (message) => {
    console.log('Processing forum thread flair for thread:', message.channel.name);
    
    try {
        // Check if thread is already locked (avoid double-processing)
        if (message.channel.locked) {
            console.log('Thread is already locked, skipping flair processing');
            return;
        }
        
        // Lock the thread immediately
        await message.channel.setLocked(true, 'Locked for flair selection');
        console.log('Thread locked for flair selection');
        
        // Create the initial selection buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`flair_artist_${message.channel.id}_${message.author.id}`)
                    .setLabel("I'm an artist looking for work")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`flair_client_${message.channel.id}_${message.author.id}`)
                    .setLabel("I'm looking for an artist")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`flair_event_${message.channel.id}_${message.author.id}`)
                    .setLabel("I'm hosting an event")
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`flair_share_${message.channel.id}_${message.author.id}`)
                    .setLabel("I'd like to share something")
                    .setStyle(ButtonStyle.Primary)
            );
        
        // Send the selection message
        const flairMessage = await message.channel.send({
            content: `🏷️ **Thread Flair Selection**\n\nPlease select the category that best describes your post:`,
            components: [row]
        });
        
        console.log('Flair selection message sent:', flairMessage.id);
        
        // Set a timeout to auto-unlock if no response (10 minutes)
        setTimeout(async () => {
            try {
                // Check if the message still exists (it gets deleted when flair is selected)
                const stillExists = await message.channel.messages.fetch(flairMessage.id).catch(() => null);
                if (stillExists) {
                    await flairMessage.delete().catch(() => {});
                    await message.channel.setLocked(false, 'Auto-unlock: No flair selected within timeout');
                    console.log('Auto-unlocked thread due to timeout');
                }
            } catch (error) {
                console.error('Error in timeout handler:', error);
            }
        }, 10 * 60 * 1000); // 10 minutes
        
    } catch (error) {
        console.error('Error in forum thread flair execute:', error);
        
        // If something goes wrong, unlock the thread
        try {
            await message.channel.setLocked(false, 'Unlocked due to flair system error');
        } catch (unlockError) {
            console.error('Failed to unlock thread after error:', unlockError);
        }
    }
}

async function handleFlairInteraction(interaction) {
    const customId = interaction.customId;
    const [action, type, threadId, originalUserId] = customId.split('_');
    
    // Check if the user pressing the button is the original thread creator
    if (interaction.user.id !== originalUserId) {
        await interaction.reply({
            content: 'Only the thread creator can select flair options.',
            ephemeral: true
        });
        return;
    }
    
    const thread = interaction.channel;
    
    // Verify we're in the correct thread
    if (thread.id !== threadId) {
        await interaction.reply({
            content: 'This interaction is not valid for this thread.',
            ephemeral: true
        });
        return;
    }
    
    switch (type) {
        case 'artist':
            await applyFlairAndFinish(interaction, thread, 'portfolio');
            break;
        case 'client':
            await handleClientSelection(interaction, thread, originalUserId);
            break;
        case 'event':
            await handleEventSelection(interaction, thread, originalUserId);
            break;
        case 'share':
            await handleShareSelection(interaction, thread, originalUserId);
            break;
        case 'paidjob':
            await applyFlairAndFinish(interaction, thread, 'paid-job');
            break;
        case 'revshare':
            await applyFlairAndFinish(interaction, thread, 'rev-share');
            break;
        case 'collab':
            await handleCollaborationSelection(interaction, thread, originalUserId);
            break;
        case 'contest':
            await applyFlairAndFinish(interaction, thread, 'contest');
            break;
        case 'eventflair':
            await applyFlairAndFinish(interaction, thread, 'event');
            break;
        case 'resource':
            await applyFlairAndFinish(interaction, thread, 'resource');
            break;
        case 'livestream':
            await applyFlairAndFinish(interaction, thread, 'livestream');
            break;
        case 'makeofficial':
            await applyMultipleFlairsAndFinish(interaction, thread, ['collaboration', 'official']);
            break;
        case 'stayunofficial':
            await applyFlairAndFinish(interaction, thread, 'collaboration');
            break;
        default:
            await interaction.reply({
                content: 'Unknown interaction type.',
                ephemeral: true
            });
    }
}

async function handleClientSelection(interaction, thread, originalUserId) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`flair_paidjob_${thread.id}_${originalUserId}`)
                .setLabel("This job is paid up front")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`flair_revshare_${thread.id}_${originalUserId}`)
                .setLabel("This job is paid via revenue sharing")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`flair_collab_${thread.id}_${originalUserId}`)
                .setLabel("I'm looking for artists to join an open project")
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({
        content: `🏷️ **Job Type Selection**\n\nPlease specify the type of work arrangement:`,
        components: [row]
    });
}

async function handleEventSelection(interaction, thread, originalUserId) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`flair_contest_${thread.id}_${originalUserId}`)
                .setLabel("Artists will compete to win")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`flair_collab_${thread.id}_${originalUserId}`)
                .setLabel("Artists will work together")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`flair_eventflair_${thread.id}_${originalUserId}`)
                .setLabel("Artists will submit art for fun")
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({
        content: `🏷️ **Event Type Selection**\n\nIn this event:`,
        components: [row]
    });
}

async function handleShareSelection(interaction, thread, originalUserId) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`flair_resource_${thread.id}_${originalUserId}`)
                .setLabel("A low-spec related resource")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`flair_livestream_${thread.id}_${originalUserId}`)
                .setLabel("A livestream")
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({
        content: `🏷️ **Share Type Selection**\n\nWhat would you like to share?`,
        components: [row]
    });
}

async function handleCollaborationSelection(interaction, thread, originalUserId) {
    // Check if user has mod permissions
    const member = await interaction.guild.members.fetch(originalUserId);
    const hasModPerms = member.permissions.has(PermissionFlagsBits.ManageThreads) || 
                       member.permissions.has(PermissionFlagsBits.Administrator);
    
    if (!hasModPerms) {
        await applyFlairAndFinish(interaction, thread, 'collaboration');
        return;
    }
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`flair_makeofficial_${thread.id}_${originalUserId}`)
                .setLabel("Mark as Official")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`flair_stayunofficial_${thread.id}_${originalUserId}`)
                .setLabel("Keep Unofficial")
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({
        content: `🏷️ **Official Status**\n\nYou have moderator permissions. Would you like to mark this collaboration as official?`,
        components: [row]
    });
}

async function applyFlairAndFinish(interaction, thread, flairType) {
    try {
        const tagName = FLAIR_TAGS[flairType];
        const parentForum = thread.parent;
        const existingTag = parentForum.availableTags.find(tag => tag.name === tagName);
        
        if (existingTag) {
            await thread.setAppliedTags([existingTag.id]);
        } else {
            console.warn(`Forum tag "${tagName}" not found in forum channel`);
        }
        
        await finishFlairProcess(interaction, thread, [tagName]);
    } catch (error) {
        console.error('Error applying flair:', error);
        await interaction.update({
            content: `❌ **Error**\n\nFailed to apply flair. The thread will be unlocked.`,
            components: []
        });
        await thread.setLocked(false);
    }
}

async function applyMultipleFlairsAndFinish(interaction, thread, flairTypes) {
    try {
        const parentForum = thread.parent;
        const tagNames = flairTypes.map(type => FLAIR_TAGS[type]);
        const tagsToApply = tagNames.map(tagName => 
            parentForum.availableTags.find(tag => tag.name === tagName)
        ).filter(tag => tag);
        
        if (tagsToApply.length > 0) {
            await thread.setAppliedTags(tagsToApply.map(tag => tag.id));
        }
        
        await finishFlairProcess(interaction, thread, tagNames);
    } catch (error) {
        console.error('Error applying multiple flairs:', error);
        await interaction.update({
            content: `❌ **Error**\n\nFailed to apply flair. The thread will be unlocked.`,
            components: []
        });
        await thread.setLocked(false);
    }
}

async function finishFlairProcess(interaction, thread, appliedFlairs) {
    try {
        // Remove the flair selection message
        await interaction.message.delete().catch(err => 
            console.log('Could not delete flair message (may already be deleted):', err.message)
        );
        
        // Unlock the thread
        await thread.setLocked(false, 'Flair selection completed');
        console.log('Thread unlocked after flair selection');
        
        // Send ephemeral success message
        await interaction.followUp({
            content: `✅ **Flair Applied Successfully**\n\nApplied flair(s): ${appliedFlairs.join(', ')}\n\nYour thread has been unlocked and is ready for discussion!`,
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error in finishFlairProcess:', error);
        
        // Ensure thread gets unlocked even if other operations fail
        try {
            await thread.setLocked(false, 'Unlocked after flair error');
        } catch (unlockError) {
            console.error('Critical error: Could not unlock thread:', unlockError);
        }
        
        // Try to notify the user of the error
        try {
            await interaction.followUp({
                content: `⚠️ **Partial Success**\n\nFlair was applied but there was an error completing the process. Your thread has been unlocked.`,
                ephemeral: true
            });
        } catch (notifyError) {
            console.error('Could not notify user of error:', notifyError);
        }
    }
}

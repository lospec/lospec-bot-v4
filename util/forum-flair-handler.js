import { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
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

export async function handleFlairInteraction(interaction) {
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
            await handleArtistSelection(interaction, thread, originalUserId);
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

async function handleArtistSelection(interaction, thread, originalUserId) {
    await applyFlairAndFinish(interaction, thread, 'portfolio');
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
        const tags = await getOrCreateForumTags(thread.parent, [flairType]);
        const tagToApply = tags.find(tag => tag.name === FLAIR_TAGS[flairType]);
        
        if (tagToApply) {
            await thread.setAppliedTags([tagToApply.id]);
        }
        
        await finishFlairProcess(interaction, thread, [FLAIR_TAGS[flairType]]);
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
        const tags = await getOrCreateForumTags(thread.parent, flairTypes);
        const tagsToApply = flairTypes.map(type => 
            tags.find(tag => tag.name === FLAIR_TAGS[type])
        ).filter(tag => tag);
        
        if (tagsToApply.length > 0) {
            await thread.setAppliedTags(tagsToApply.map(tag => tag.id));
        }
        
        await finishFlairProcess(interaction, thread, flairTypes.map(type => FLAIR_TAGS[type]));
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

async function getOrCreateForumTags(forumChannel, flairTypes) {
    const existingTags = forumChannel.availableTags;
    const neededTags = [];
    
    for (const flairType of flairTypes) {
        const tagName = FLAIR_TAGS[flairType];
        let existingTag = existingTags.find(tag => tag.name === tagName);
        
        if (!existingTag) {
            // Create the tag if it doesn't exist
            try {
                const newTag = await forumChannel.setAvailableTags([
                    ...existingTags,
                    { name: tagName, emoji: getEmojiForFlair(flairType) }
                ]);
                existingTag = newTag.find(tag => tag.name === tagName);
            } catch (error) {
                console.error(`Failed to create tag ${tagName}:`, error);
            }
        }
        
        if (existingTag) {
            neededTags.push(existingTag);
        }
    }
    
    return [...existingTags, ...neededTags];
}

function getEmojiForFlair(flairType) {
    const emojiMap = {
        'portfolio': '🎨',
        'paid-job': '💰',
        'rev-share': '🤝',
        'collaboration': '👥',
        'contest': '🏆',
        'event': '🎉',
        'resource': '📚',
        'livestream': '📺',
        'official': '⭐'
    };
    
    return emojiMap[flairType] || '🏷️';
}

import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import client from '../client.js';
import { checkIfUserCanAfford, takeUsersMoney } from '../util/lozpekistan-bank.js';
import { getEmojiOnServer, removeEmojiFromServer, checkIfEmojiIsRemovable, checkIfEmojiExistsOnServer, checkIfServerHasFreeEmojiSlots, addEmojiToServer, ensureEmojiExistsOnServer } from '../util/emoji.js';
import {CONFIG} from '../data.js';
import { simpleGit} from 'simple-git';
import fsp from 'fs/promises';
import path from 'path';
import { scalePng } from '../util/scale-png.js';

await CONFIG.assert('updateEmojiPrice');

const OUTPUT_PATH = '_emoji-archive';
const PRICE = CONFIG.get('updateEmojiPrice');

export const config = {
	name: 'update-emoji', 
	description: 'Update an emoji on this server to the newest version (costs '+PRICE+'P)', 
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'emoji',
			description: 'The name of an emoji to update (must match an emoji in this server)',
			type: ApplicationCommandOptionType.String,
			required: true,
		}
	]
};

const confirmationActionRow = {
	type: 1,
	components: [
		{
			type: 2,
			style: 1,
			label: 'Update Emoji',
			customId: 'update_emoji_confirm'
		},
		{
			type: 2,
			style: 2,
			label: 'Cancel',
			customId: 'update_emoji_cancel'
		}
	]
};

export const execute = async (interaction) => {
    const emojiName = interaction.options.getString('emoji');
    const emojiPath = path.join(OUTPUT_PATH,'current',emojiName+'.png');
    let emojiImageScaled;

    try {
        await updateEmojiArchiveToLatest();
        await checkIfUserCanAfford(interaction.user.id, PRICE);
        await checkIfEmojiIsInArchive(emojiPath);
        await ensureEmojiExistsOnServer(interaction.guild, emojiName);
        await checkIfEmojiIsRemovable(emojiName);
        emojiImageScaled = await scalePng(emojiPath);
    }
    catch (err) {
        console.log('update emoji request failed:',err);
        await interaction.reply({content: "Failed to update emoji. " + err.message, ephemeral: true});
        return;
    }

	const currentEmojiTag = '<:'+emojiName+':'+interaction.guild.emojis.cache.find(e => e.name === emojiName).id+'>';

    const embed = {
        title: 'Confirm Purchase',
        description: 'You are updating the emoji '+currentEmojiTag+' (`:'+emojiName+':`) on the server. Please ensure the emoji is not already updated to the latest version. \n\n This will cost you **'+PRICE+'P**. \n\n Are you sure you wish to do this?',
        thumbnail: {url: 'attachment://emoji.png'},
        author: {name: ':'+emojiName+':'},
    };

    await interaction.reply({
        files: [new AttachmentBuilder(emojiImageScaled, {name: 'emoji.png'})],
        embeds: [embed],
        components: [confirmationActionRow],
        ephemeral: true
    });
};

client.on('interactionCreate', async interaction => {
	try {
		if (!interaction.isButton()) return;
		if (interaction.customId === 'update_emoji_confirm') 
			confirmUpdateEmoji(interaction);
		else if (interaction.customId === 'update_emoji_cancel') 
			interaction.update({content: 'Update emoji request cancelled.', embeds: [], components: [], attachments: []});
	}
	catch (err) {
		console.log('update emoji request failed:',err);
		await interaction.update({content: "Failed to update emoji. " + err.message, embeds: [], components: [], attachments: []});
	}
});

async function confirmUpdateEmoji(interaction) {
    try {
        const emojiName = interaction.message.embeds[0].author.name.replace(/:/g,'');
        const emojiPath = path.join(OUTPUT_PATH,'current',emojiName+'.png');

        //checks
        await updateEmojiArchiveToLatest();
        await checkIfUserCanAfford(interaction.user.id, PRICE);
        await checkIfEmojiIsInArchive(emojiPath);
        await ensureEmojiExistsOnServer(interaction.guild, emojiName);
        await checkIfEmojiIsRemovable(emojiName);

        //make it happen
        await takeUsersMoney(interaction.user.id, PRICE);
        await removeEmojiFromServer(interaction, emojiName);
        let emojiTag = await addEmojiToServer(interaction, emojiPath, emojiName);

        await interaction.update({content: 'The emoji '+emojiTag+' `:'+emojiName+':` has been successfully updated! ', embeds: [], components: [], attachments: []});

        //send announcement to emoji changes channel
        const announcementChannel = await client.channels.fetch(CONFIG.get('emojiChangesAnnouncementsChannelId'));
        await announcementChannel.send({content: '🎉 '+interaction.user.toString()+' has updated the '+emojiTag+' `:'+emojiName+':` emoji on the server!'});
    }
    catch (err) {
        console.log('update emoji request failed:',err);
        await interaction.update({content: "Failed to update emoji. " + err.message, embeds: [], components: [], attachments: []});
        return;
    }
}


async function updateEmojiArchiveToLatest () {
    console.log(' > updating emoji archive to latest...');
    const git = simpleGit({baseDir: OUTPUT_PATH});
    await git.fetch('origin','main');
    const status = await git.status();
    if (status.behind > 0) {
        console.log(' > emoji archive is behind by '+status.behind+' commits, pulling latest changes');
        await git.pull();
        console.log(' > done updating emoji archive');
    }
    else
        console.log(' > emoji archive is already up to date');
}

async function checkIfEmojiIsInArchive (emojiPath) {
    try {
        await fsp.access(emojiPath);
    }
    catch (err) {
        throw new Error('Emoji not found in the Lospec Emoji Archive. Please make sure the emoji has been added to the archive before trying to update it.');
    }
}
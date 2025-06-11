import { AttachmentBuilder } from 'discord.js';
import client from '../../client.js';
import { checkIfUserCanAfford, takeUsersMoney } from '../../util/lozpekistan-bank.js';
import { removeEmojiFromServer, checkIfEmojiIsRemovable, addEmojiToServer, ensureEmojiExistsOnServer, updateEmojiArchiveToLatest, checkIfEmojiIsInArchive } from '../../util/emoji.js';
import { EMOJI_DATA } from '../../data.js';
import path from 'path';
import { scalePng } from '../../util/scale-png.js';

const OUTPUT_PATH = '_emoji-archive';

await EMOJI_DATA.assert('updateEmojiPrice');
const PRICE = EMOJI_DATA.get('updateEmojiPrice');

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

export default async (interaction) => {
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
        const announcementChannel = await client.channels.fetch(EMOJI_DATA.get('emojiChangesAnnouncementsChannelId'));
        await announcementChannel.send({content: '🌟 '+interaction.user.toString()+' has updated the '+emojiTag+' `:'+emojiName+':` emoji on the server!'});
    }
    catch (err) {
        console.log('update emoji request failed:',err);
        await interaction.update({content: "Failed to update emoji. " + err.message, embeds: [], components: [], attachments: []});
        return;
    }
}

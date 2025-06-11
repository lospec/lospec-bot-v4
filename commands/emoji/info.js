import { AttachmentBuilder } from 'discord.js';
import path, { format } from 'path';
import { scalePng } from '../../util/scale-png.js';
import { getEmojiInfo, getEmojiOnServer, updateEmojiArchiveToLatest, checkIfEmojiIsInArchive, formatEmojiDate } from '../../util/emoji.js';
import { generateEmojiHistoryImage } from '../../util/generate-emoji-history-image.js';

const OUTPUT_PATH = '_emoji-archive';

export default async (interaction) => {
    const emojiName = interaction.options.getString('emoji');
    const postPublicly = interaction.options.getBoolean('public') ?? false;
    const emojiPath = path.join(OUTPUT_PATH, 'current', emojiName + '.png');

	let emojiInfo;
	try {
		await updateEmojiArchiveToLatest();
		await checkIfEmojiIsInArchive(emojiPath);
		emojiInfo = await getEmojiInfo(emojiName);
	}
	catch (err) {
		console.log('emoji info request failed:',err);
		await interaction.reply({content: `No record of an emoji called :${emojiName}: was found in the Lozpekistan Emoji Archive. \nPlease ensure the emoji exists and try again.`, ephemeral: true});
		return;
	}

	let emojiIsOnServer, serverEmojiTag;
	try	{ 
		const emoji = await getEmojiOnServer(interaction.guild, emojiName);
		emojiIsOnServer = true;
		serverEmojiTag = `<:${emojiName}:${emoji.id}>`;
	} 
	catch (err) { emojiIsOnServer = false;}

	let emojiImageScaled = await scalePng(emojiPath);

    const historyText = emojiInfo.history.map(entry => {
        return `${formatEmojiDate(entry.date)}: ${entry.version === '1'?'created':'updated'} by **${entry.author}**`;
    }).join('\n');

    // Generate the history image
    let historyImageAttachment = null;
    const historyImageBuffer = await generateEmojiHistoryImage(emojiName, emojiInfo.history, emojiInfo.currentVersion);
    if (historyImageBuffer) {
        historyImageAttachment = new AttachmentBuilder(historyImageBuffer, { name: 'history.png' });
    }

    const embed = {
        title: `:${emojiName}: Emoji Information`,
        thumbnail: { url: 'attachment://emoji.png' },
		description: `
			\n**Status:** ${emojiIsOnServer ? 'In server' : 'Not in server'}
			\n**Category:** ${emojiInfo.category}
			\n**History:** \n${historyText}`,
		footer: {text: `Emoji data sourced from the Lospec Emoji Archive`},
    };

    // If history image was generated, add it to the embed
    if (historyImageAttachment) {
        embed.image = { url: 'attachment://history.png' };
    }
    
    const files = [new AttachmentBuilder(emojiImageScaled, { name: 'emoji.png' })];
    if (historyImageAttachment) {
        files.push(historyImageAttachment);
    }

    await interaction.reply({
        files: files,
        embeds: [embed],
        ephemeral: !postPublicly
    });
};

import { AttachmentBuilder } from 'discord.js';
import path, { format } from 'path';
import { scalePng } from '../../util/scale-png.js';
import { getEmojiInfo, getEmojiOnServer, updateEmojiArchiveToLatest, checkIfEmojiIsInArchive, formatEmojiDate } from '../../util/emoji.js';

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
		console.log('emoji found on server:', emoji);
		emojiIsOnServer = true;
		serverEmojiTag = `<:${emojiName}:${emoji.id}>`;
	} 
	catch (err) { emojiIsOnServer = false;}

	let emojiImageScaled = await scalePng(emojiPath);

    const historyText = emojiInfo.history.map(entry => {
        return `${formatEmojiDate(entry.date)}: ${entry.version === '1'?'created':'updated'} by **${entry.author}**`;
    }).join('\n');

    const embed = {
        title: `:${emojiName}: Emoji Information`,
        thumbnail: { url: 'attachment://emoji.png' },
		description: `
			\n**Category:** ${emojiInfo.category}
			\n**History:** \n${historyText}
			\n${emojiIsOnServer ? `This emoji is currently present in the server: ${serverEmojiTag}`: `This emoji is not currently present in the server. You can add it using the \`/emoji add\` command.`}
			\n-# Emoji data sourced from the [Lospec Emoji Archive](https://github.com/lospec/emoji-archive)
			`,
    };

    await interaction.reply({
        files: [new AttachmentBuilder(emojiImageScaled, { name: 'emoji.png' })],
        embeds: [embed],
        ephemeral: !postPublicly
    });
};

import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import { simpleGit} from 'simple-git';
import fsp from 'fs/promises';
import path from 'path';
import { PNG } from 'pngjs';

const EMOJI_ARCHIVE_URL = 'https://github.com/lospec/emoji-archive.git';
const OUTPUT_PATH = '_emoji-archive';
const PRICE = 20;

try {
	await fsp.access(OUTPUT_PATH);
	console.log('folder '+OUTPUT_PATH+' exists');
	const git = simpleGit({baseDir: OUTPUT_PATH});
	//update the repo to the latest version
	await git.fetch('origin','main');
	await git.checkout('main');
	console.log('updated emoji archive');
} 
catch (err) {
	await fsp.mkdir(OUTPUT_PATH);
	console.log('created folder '+OUTPUT_PATH);
	const git = simpleGit({baseDir: OUTPUT_PATH});
	try {
		await git.init();
		await git.addRemote('origin', EMOJI_ARCHIVE_URL);
		await git.fetch('origin','main');
		await git.checkout('main');

		console.log('fetched emoji archive');
	} catch (err) {
		console.error('Error initializing git repo',err);
	}
}

export const config = {
	name: 'add-emoji', 
	description: 'Add an emoji from the Lospec Emoji Archive to the server (costs '+PRICE+'P)', 
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'emoji',
			description: 'The emoji to add (must match an emoji in the Lospec Emoji Archive)',
			type: ApplicationCommandOptionType.String,
			required: true,
		}
	]
};

//creat an action row with 2 buttons, "add emoji" and "cancel"
const confirmationActionRow = {
	type: 1,
	components: [
		{
			type: 2,
			style: 1,
			label: 'Add Emoji',
			customId: 'add_emoji'
		},
		{
			type: 2,
			style: 2,
			label: 'Cancel',
			customId: 'cancel'
		}
	]
};

export const execute = async (interaction) => {

	//update repo to latest version
	const git = simpleGit({baseDir: OUTPUT_PATH});
	await git.fetch('origin','main');
	await git.checkout('main');

	const emoji = interaction.options.getString('emoji');

	//check if the emoji exists in the emoji archive
	const emojiPath = path.join(OUTPUT_PATH,'current',emoji+'.png');
	try {
		await fsp.access(emojiPath );
	}
	catch (err) {
		await interaction.reply({content: 'Emoji not found in the Lospec Emoji Archive. Please make sure the emoji has been added to the archive before trying to add it.', ephemeral: true});
		return;
	}

	//make sure this emoji does not already exist in the server
	const existingEmoji = interaction.guild.emojis.cache.find(e => e.name === emoji);
	if (existingEmoji) {
		await interaction.reply({content: 'The emoji `:'+emoji+':` already exists in the server. This command is for adding emojis that are in the archive, but not currently present on the server.', ephemeral: true});
		return;
	} else {
		console.log('emoji does not exist in server');
	}

	//scale the emoji image
	let emojiImageScaled = await scalePng(emojiPath);

	//create an embed
	const embed = {
		title: 'Confirm Purchase',
		description: 'You are adding the emoji `:'+emoji+':` to the server. \n\n This will cost you 20P. \n\n Are you sure you wish to do this?',
		thumbnail: {url: 'attachment://emoji.png'},
	};

	//send a message with the action row
	await interaction.reply({
		files: [new AttachmentBuilder(emojiImageScaled, {name: 'emoji.png'})],
		embeds: [embed],
		components: [confirmationActionRow],
	});

};

async function scalePng (imagePath, scale=4) {
	const currentImage = await fsp.readFile(imagePath);
	const sourcePng = PNG.sync.read(currentImage);
	const targetPng = new PNG({width: sourcePng.width*scale, height: sourcePng.height*scale});

	for (let y = 0; y < sourcePng.height; y++) {
		for (let x = 0; x < sourcePng.width; x++) {
			const idx = (sourcePng.width * y + x) << 2;
			const color = {
				r: sourcePng.data[idx],
				g: sourcePng.data[idx+1],
				b: sourcePng.data[idx+2],
				a: sourcePng.data[idx+3]
			};

			for (let dy = 0; dy < scale; dy++) {
				for (let dx = 0; dx < scale; dx++) {
					const targetIdx = (targetPng.width * (y*scale + dy) + (x*scale + dx)) << 2;
					targetPng.data[targetIdx] = color.r;
					targetPng.data[targetIdx+1] = color.g;
					targetPng.data[targetIdx+2] = color.b;
					targetPng.data[targetIdx+3] = color.a;
				}
			}
		}
	}

	return PNG.sync.write(targetPng);
}
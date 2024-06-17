import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import { simpleGit} from 'simple-git';
import fsp from 'fs/promises';
import path from 'path';
import { PNG } from 'pngjs';
import fetch from 'node-fetch';

const EMOJI_ARCHIVE_URL = 'https://github.com/lospec/emoji-archive.git';
const OUTPUT_PATH = '_emoji-archive';
const PRICE = 20;

try {
	await fsp.access(OUTPUT_PATH);
	console.log('folder '+OUTPUT_PATH+' exists');
	await updateEmojiArchiveToLatest();
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
	const emojiName = interaction.options.getString('emoji');
	const emojiPath = path.join(OUTPUT_PATH,'current',emojiName+'.png');
	let emojiImageScaled;

	try {
		await updateEmojiArchiveToLatest();
		await checkIfUserCanAfford(interaction.user.id);
		await checkIfEmojiIsInArchive(emojiPath);
		await checkIfEmojiIsAlreadyInServer(interaction.guild, emojiName);
		emojiImageScaled = await scalePng(emojiPath);
	}
	catch (err) {
		console.log('add emoji request failed:',err);
		await interaction.reply({content: "Failed to add emoji. " + err.message, ephemeral: true});
		return;
	}

	const embed = {
		title: 'Confirm Purchase',
		description: 'You are adding the emoji `:'+emojiName+':` to the server. \n\n This will cost you **20P**. \n\n Are you sure you wish to do this?',
		thumbnail: {url: 'attachment://emoji.png'},
	};

	await interaction.reply({
		files: [new AttachmentBuilder(emojiImageScaled, {name: 'emoji.png'})],
		embeds: [embed],
		components: [confirmationActionRow],
	});
};

async function updateEmojiArchiveToLatest () {
	const git = simpleGit({baseDir: OUTPUT_PATH});
	await git.fetch('origin','main');
	await git.checkout('main');
}

async function checkIfEmojiIsInArchive (emojiPath) {
	try {
		await fsp.access(emojiPath);
	}
	catch (err) {
		throw new Error('Emoji not found in the Lospec Emoji Archive. Please make sure the emoji has been added to the archive before trying to add it.');
	}
}

async function checkIfEmojiIsAlreadyInServer (guild, emojiName) {
	const existingEmoji = guild.emojis.cache.find(e => e.name === emojiName);
	if (existingEmoji) 
		throw new Error('Emoji already exists in server.');
}

async function checkIfUserCanAfford (userId) {
	let balance;

	try {
		const response = await fetch('http://'+process.env.LOZPEKISTAN_BANK_API_ADDRESS+'/balance/'+userId, {
			headers: {
				Authorization: process.env.LOZPEKISTAN_BANK_API_KEY
			}
		});
		console.log('response:',response);
		const data = await response.json();
		console.log('user balance:',data);
		balance = data;
	}
	catch (err) {
		console.error('Failed to check user balance',err);
		throw new Error('Failed to check user balance');
	}

	if (balance > PRICE) return;
	throw new Error('You do not have enough P to purchase this emoji. You need '+PRICE+'P, but you only have '+balance+'P.');
}

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
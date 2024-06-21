import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import { simpleGit} from 'simple-git';
import fsp from 'fs/promises';
import path from 'path';
import client from '../client.js';
import { checkIfUserCanAfford, takeUsersMoney } from '../util/lozpekistan-bank.js';
import { scalePng } from '../util/scale-png.js';
import { checkIfEmojiExistsOnServer, checkIfServerHasFreeEmojiSlots, addEmojiToServer } from '../util/emoji.js';
import {CONFIG} from '../data.js';
await CONFIG.assert('emojiChangesAnnouncementsChannelId');
await CONFIG.assert('addEmojiPrice');

const EMOJI_ARCHIVE_URL = 'https://github.com/lospec/emoji-archive.git';
const OUTPUT_PATH = '_emoji-archive';
const PRICE = CONFIG.get('addEmojiPrice');

try {
	await fsp.access(OUTPUT_PATH);
	console.log('folder '+OUTPUT_PATH+' exists');
	await updateEmojiArchiveToLatest();
} 
catch (err) {
	console.log(' > folder '+OUTPUT_PATH+' does not exist, creating...');
	await fsp.mkdir(OUTPUT_PATH);
	console.log(' > created folder '+OUTPUT_PATH);
	const git = simpleGit({baseDir: OUTPUT_PATH});
	try {
		console.log(' > fetching git repo '+EMOJI_ARCHIVE_URL+'...');
		await git.init();
		await git.addRemote('origin', EMOJI_ARCHIVE_URL);
		await git.fetch('origin','main');
		await git.checkout('main');

		console.log(' > fetched emoji archive');
	} catch (err) {
		console.error(' > Error initializing git repo',err);
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
			customId: 'add_emoji_confirm'
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
		await checkIfUserCanAfford(interaction.user.id, PRICE);
		await checkIfEmojiIsInArchive(emojiPath);
		await checkIfEmojiExistsOnServer(interaction.guild, emojiName);
		await checkIfServerHasFreeEmojiSlots(interaction.guild);
		emojiImageScaled = await scalePng(emojiPath);
	}
	catch (err) {
		console.log('add emoji request failed:',err);
		await interaction.reply({content: "Failed to add emoji. " + err.message, ephemeral: true});
		return;
	}

	const embed = {
		title: 'Confirm Purchase',
		description: 'You are adding the emoji `:'+emojiName+':` to the server. \n\n This will cost you **'+PRICE+'P**. \n\n Are you sure you wish to do this?',
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
		throw new Error('Emoji not found in the Lospec Emoji Archive. Please make sure the emoji has been added to the archive before trying to add it.');
	}
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;
	if (interaction.customId === 'add_emoji_confirm') 
		confirmAddEmoji(interaction);
	else if (interaction.customId === 'cancel') 
		interaction.update({content: 'Add emoji request cancelled.', embeds: [], components: [], attachments: []});
});

async function confirmAddEmoji(interaction) {
	try {
		const emojiName = interaction.message.embeds[0].author.name.replace(/:/g,'');
			console.log('adding emoji:',emojiName);
		const emojiPath = path.join(OUTPUT_PATH,'current',emojiName+'.png');

		//checks
		await updateEmojiArchiveToLatest();
		await checkIfUserCanAfford(interaction.user.id, PRICE);
		await checkIfEmojiIsInArchive(emojiPath);
		await checkIfEmojiExistsOnServer(interaction.guild, emojiName);
		await checkIfServerHasFreeEmojiSlots(interaction.guild);

		//make it happen
		await takeUsersMoney(interaction.user.id, PRICE);
		let emojiTag = await addEmojiToServer(interaction, emojiPath, emojiName);

		await interaction.update({content: 'The emoji '+emojiTag+' `:'+emojiName+':` has been successfully added! ', embeds: [], components: [], attachments: []});

		//send announcement to emoji changes channel
		const announcementChannel = await client.channels.fetch(CONFIG.get('emojiChangesAnnouncementsChannelId'));
		await announcementChannel.send({content: '🎉 '+interaction.user.toString()+' has added the '+emojiTag+' `:'+emojiName+':` emoji to the server!'});
	}
	catch (err) {
		console.log('add emoji request failed:',err);
		await interaction.update({content: "Failed to add emoji. " + err.message, embeds: [], components: [], attachments: []});
		return;
	}
}


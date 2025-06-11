import { scalePng } from '../util/scale-png.js';
import { simpleGit} from 'simple-git';
import fsp from 'fs/promises';
import path from 'path';


const EMOJI_ARCHIVE_PATH = '_emoji-archive';

const EMOJI_SLOTS_PER_TIER = [50,100,150,250];

export async function checkIfEmojiExistsOnServer (guild, emojiName) {
	const existingEmoji = (await guild.emojis.fetch()).find(e => e.name === emojiName);
	if (existingEmoji) 
		throw new Error('Emoji already exists in server.');
}

export async function ensureEmojiExistsOnServer (guild, emojiName) {
	const existingEmoji = (await guild.emojis.fetch()).find(e => e.name === emojiName);
	if (!existingEmoji) 
		throw new Error('The emoji does not yet exist on this server.');
}

export async function getEmojiOnServer (guild, emojiName) {
	const emoji = (await guild.emojis.fetch()).find(e => e.name === emojiName);
	if (!emoji) throw new Error('The emoji `:'+emojiName+':` does not exist on this server.');
	return emoji;
}


export async function checkIfServerHasFreeEmojiSlots (guild) {
	const premiumTier = guild.premiumTier;
	const totalEmojiSlots = EMOJI_SLOTS_PER_TIER[premiumTier];
	const usedEmojiSlots = (await guild.emojis.fetch()).size;
	const freeEmojiSlots = totalEmojiSlots - usedEmojiSlots;
	console.log('server has',freeEmojiSlots,'free emoji slots', {premiumTier, totalEmojiSlots, usedEmojiSlots});

	if (freeEmojiSlots > 0) return;
	throw new Error('The server currently has no free emoji slots. Use `/emoji remove` to free up a slot before adding a new emoji.');
}


export async function addEmojiToServer (interaction, emojiPath, emojiName) {
	try {
		const emojiImageScaled = await scalePng(emojiPath);
		const emoji = await interaction.guild.emojis.create({ attachment: emojiImageScaled, name: emojiName });
		return emoji.toString();
	} catch (err) {
		console.error('Failed to add emoji to server',err);
		throw new Error('Failed to add emoji to discord server');
	}
}

export async function checkIfEmojiIsRemovable (emojiName) {
	if (emojiName.match(/[A-Z]/)) throw new Error('This is a protected emoji and it cannot be removed.');
	if (emojiName == 'pikzel') throw new Error('This would destroy the economy.');
	if (emojiName == 'birb') throw new Error('You are not powerful enough to remove :birb:.');
	if (emojiName == 'love') throw new Error('Why would you want to kill love? What is wrong with you?');
}

export async function removeEmojiFromServer(interaction, emojiName) {
	try {
		let emoji = (await interaction.guild.emojis.fetch()).find(emoji => emoji.name === emojiName);
		if (!emoji) throw new Error('The emoji `:'+emojiName+':` does not exist on this server.');
		console.log('deleting:', emoji);
		await emoji.delete('Paid for by '+interaction.user.tag);
	}
	catch (err) {
		throw new Error('Failed to remove emoji from server. '+err.message);
	}
}

export async function updateEmojiArchiveToLatest () {
    console.log(' > updating emoji archive to latest...');
    const git = simpleGit({baseDir: EMOJI_ARCHIVE_PATH});
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

export async function checkIfEmojiIsInArchive (emojiPath) {
    try {
        await fsp.access(emojiPath);
    }
    catch (err) {
		console.error(err);
        throw new Error('Emoji not found in the Lospec Emoji Archive. Please make sure the emoji has been added to the archive before trying to update it.');
    }
}

export async function getEmojiInfo(emojiName) {
	const creditsCsv = await fsp.readFile(path.join(EMOJI_ARCHIVE_PATH, 'credits.csv'), 'utf-8');
		if (!creditsCsv) throw new Error('Emoji credits file not found or empty.');
	const lines = creditsCsv.split('\n');

	const emojiInfo = {
		currentVersion: 0,
		currentAuthor: 'Unknown',
		originalAuthor: 'Unknown',
		createdOn: 'Unknown',
		lastUpdate: 'Unknown',
		category: 'Unknown',
		history: []
	};

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue; // Skip empty lines

		const [name, version, author, date, category] = line.split(',');
		if (name !== emojiName) continue;
		if (isNaN(parseInt(version))) continue;

		if (emojiInfo.currentVersion === 0) {
			emojiInfo.originalAuthor = author;
			emojiInfo.createdOn = date;
		}

		if (version > emojiInfo.currentVersion) {
			emojiInfo.currentVersion = version;
			emojiInfo.currentAuthor = author;
			emojiInfo.lastUpdate = date;
			emojiInfo.category = category;
		}

		emojiInfo.history.push({version, author, date, category});
	}

	if (emojiInfo.currentVersion === 0) throw new Error(`No emoji called :${emojiName}: was found.`);

	return emojiInfo;
}

export function formatEmojiDate(dateString) {
	const date = new Date(dateString);
	const options = { year: 'numeric', month: 'short', day: 'numeric' };
	return date.toLocaleDateString('en-US', options);
}


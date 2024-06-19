import { scalePng } from '../util/scale-png.js';

const EMOJI_SLOTS_PER_TIER = [50,100,150,250];

export async function checkIfEmojiExistsOnServer (guild, emojiName) {
	const existingEmoji = (await guild.emojis.fetch()).find(e => e.name === emojiName);
	if (existingEmoji) 
		throw new Error('Emoji already exists in server.');
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
	throw new Error('The server currently has no free emoji slots.');
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


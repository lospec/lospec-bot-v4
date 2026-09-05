// LFTs are stored as application emojis, which belong to the bot itself rather
// than to any one server - the bot can use them in its messages everywhere, and
// there is room for 2000 of them.
//
// discord.js 14.11 predates application emojis, so these endpoints are called
// directly through the rest client instead of through the library.

import { REST } from '@discordjs/rest';

const rest = new REST({version: '10'}).setToken(process.env.DISCORD_BOT_TOKEN);

export const MAX_APPLICATION_EMOJIS = 2000;

//the emoji name is separate from the LFT name so LFT emojis are easy to
//pick out from any other application emojis the bot may end up with
export const EMOJI_PREFIX = 'lft_';

let emojiCount = null;


// The client is imported only when it is actually needed, so that naming and
// tag building - which every other module leans on - do not drag a discord
// connection in behind them.
async function applicationId () {
	if (process.env.DISCORD_CLIENT_ID) return process.env.DISCORD_CLIENT_ID;

	const client = (await import('../client.js')).default;
	const id = client.application?.id;
	if (!id) throw new Error('The bot does not know its own application id yet.');

	return id;
}


// lft_001_skeddles - the number is padded so the emoji list sorts in minting
// order. Discord allows 32 characters, which the 23 character cap on LFT names
// leaves room for even at four digits.
export function emojiNameFor (number, lftName) {
	return EMOJI_PREFIX + String(number).padStart(3, '0') + '_' + lftName;
}


//application emojis are rendered exactly like guild emojis. the name is stored
//on the LFT when it is minted, so a change to the naming scheme cannot make the
//tags of everything already minted wrong
export function emojiTag (lft) {
	if (!lft.emojiId) return '';
	return '<:' + (lft.emojiName || emojiNameFor(lft.number, lft.name)) + ':' + lft.emojiId + '>';
}


export async function listApplicationEmojis () {
	const response = await rest.get('/applications/' + await applicationId() + '/emojis');
	//this endpoint wraps the list in an object, unlike the guild emoji one
	const items = Array.isArray(response) ? response : (response.items || []);
	emojiCount = items.length;
	return items;
}


export async function checkForFreeEmojiSlots () {
	if (emojiCount === null) await listApplicationEmojis();
	if (emojiCount < MAX_APPLICATION_EMOJIS) return;
	throw new Error('There is no room for any more LFTs - all '+MAX_APPLICATION_EMOJIS+' slots are full.');
}


export async function createApplicationEmoji (name, pngBuffer) {
	try {
		const emoji = await rest.post('/applications/' + await applicationId() + '/emojis', {
			body: {
				name,
				image: 'data:image/png;base64,' + pngBuffer.toString('base64')
			}
		});
		if (emojiCount !== null) emojiCount++;
		console.log('created application emoji:', emoji.name, emoji.id);
		return emoji;
	}
	catch (err) {
		console.error('Failed to create application emoji', err);
		throw new Error('Discord refused to create the emoji for this LFT. '+(err.rawError?.message || err.message || ''));
	}
}


export async function deleteApplicationEmoji (emojiId) {
	try {
		await rest.delete('/applications/' + await applicationId() + '/emojis/' + emojiId);
		if (emojiCount !== null) emojiCount--;
	}
	catch (err) {
		console.error('Failed to delete application emoji', emojiId, err);
	}
}

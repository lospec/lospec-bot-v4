// Reacts with a face when somebody talks to the bot.
//
// A reply to one of its messages, or a message that pings it, gets a reaction
// picked to suit what was said: a happy face for thanks and compliments, a
// sad one for insults, and a few special cases - funny, smart, sexy, pizza.
// "no" on its own gets a yes, "yes" on its own gets a no, and anything it
// cannot make sense of gets a confused look. The reading of the message is
// done in util/sentiment.js.
//
// Separately, any mention of lospec or lozpekistan in #chat-and-wips gets a
// :lozpekistan:, whether or not the bot was being spoken to.
//
// Which emoji to use for each mood is listed below. The server's emoji come
// and go, so every pick is checked against what actually exists right now,
// and the choice is made among the survivors.

import client from '../client.js';
import { classify, isBareWord } from '../util/sentiment.js';

const LOZPEKISTAN_CHANNEL_NAME = 'chat-and-wips';
const LOZPEKISTAN_EMOJI = 'lozpekistan';
const LOZPEKISTAN_PATTERN = /lospec|lozp[eé]k/i;

//spelling variants are listed where the archive and the request disagree;
//whichever exists on the server is the one used
const EMOJI_BY_MOOD = {
	positive: [
		'flattered', 'cute', 'haha', 'biggrin', 'aaahhh', 'love', 'widesmile', 'anime',
		'coolestpersoneverrightthere', 'coolestpersoneverrighthere', 'coolguy', 'pog', 'popteamlospec',
		'sobby', 'sadge', 'winka', 'serene', 'salut', 'tiny', 'kissywink', 'glee', 'ayy',
	],
	negative: [
		'coolsob', 'craig', 'acreature', 'ooohhh', 'saurry', 'yikers', 'disgrunted', 'disgruntled', 'miffed',
		'awkward', 'heartbroken', 'oops', 'painscream', 'nopixels', 'reallygrrl', 'uh', 'sideeye',
		'pensivecowboy', 'nah', 'lookup', 'tears', 'zonked', 'exaspiration', 'exasperation', 'xx',
	],
	funny: ['haha', 'laugh', 'whosgonnatellbro', 'clueless'],
	sexy: ['rizz', 'smirkle', 'handsome', 'uh'],
	smart: ['wise', 'bigbrain', 'think'],
	pizza: ['pizzer', 'pizzi'],
	confused: ['befuddled', 'confusion', 'rocksus', 'okey'],
	//"no" alone is answered with yes, and "yes" alone with no
	no: ['yes'],
	yes: ['no'],
};


// ------------------------------------------------- what exists right now

//the server's emoji, refreshed every few minutes. the client is not given the
//emoji intent, so the cache is not kept up to date on its own - a fetch is
//the only way to know what is really there
const EMOJI_CACHE_TTL = 5 * 60 * 1000;
const emojiCache = new Map(); //guild id -> {at, byName}

async function serverEmoji (guild) {
	const cached = emojiCache.get(guild.id);
	if (cached && Date.now() - cached.at < EMOJI_CACHE_TTL) return cached.byName;

	const byName = new Map();
	for (const emoji of (await guild.emojis.fetch()).values()) byName.set(emoji.name, emoji);
	emojiCache.set(guild.id, {at: Date.now(), byName});
	return byName;
}


//a random emoji for the mood, out of the ones that exist. a mood none of
//whose emoji exist falls back to the confused faces; if those are gone too
//there is nothing to react with
async function pickEmoji (guild, mood) {
	const existing = await serverEmoji(guild);

	for (const candidates of [EMOJI_BY_MOOD[mood], EMOJI_BY_MOOD.confused]) {
		const available = candidates.map(name => existing.get(name)).filter(Boolean);
		if (available.length) return available[Math.floor(Math.random() * available.length)];
	}

	console.warn('reply-reaction: none of the emoji for "' + mood + '" exist on', guild.name);
	return null;
}


// ---------------------------------------------------------- the trigger

//was this said to the bot? a ping counts, and so does replying to one of
//its messages. the replied-to message may need fetching, and may be gone
async function isTalkingToBot (message) {
	if (!client.user) return false;
	if (message.mentions.users?.has(client.user.id)) return true;
	if (message.mentions.repliedUser?.id === client.user.id) return true;

	if (message.reference?.messageId) {
		try {
			const repliedTo = await message.fetchReference();
			return repliedTo.author?.id === client.user.id;
		}
		catch (err) {
			return false;
		}
	}

	return false;
}


function mentionsLozpekistan (message) {
	if (message.channel.name !== LOZPEKISTAN_CHANNEL_NAME) return false;
	return LOZPEKISTAN_PATTERN.test(message.content || '');
}


function moodOf (content) {
	if (isBareWord(content, 'no')) return 'no';
	if (isBareWord(content, 'yes')) return 'yes';
	return classify(content) || 'confused';
}


//the filter works out whether the message was to the bot, which may cost a
//fetch, so the answer is kept on the message for execute rather than asked twice
export const filter = async (message) => {
	if (!message.guild) return false;
	if (message.author.bot) return false;
	message.talkingToBot = await isTalkingToBot(message);
	return message.talkingToBot || mentionsLozpekistan(message);
};


export const execute = async (message) => {
	const reactions = [];

	if (message.talkingToBot) {
		const mood = moodOf(message.content);
		const emoji = await pickEmoji(message.guild, mood);
		console.log('reply-reaction:', JSON.stringify(message.content), '->', mood, '->', emoji ? ':' + emoji.name + ':' : 'nothing');
		if (emoji) reactions.push(emoji);
	}

	if (mentionsLozpekistan(message)) {
		const emoji = (await serverEmoji(message.guild)).get(LOZPEKISTAN_EMOJI);
		if (emoji) reactions.push(emoji);
		else console.warn('reply-reaction: :' + LOZPEKISTAN_EMOJI + ': does not exist on', message.guild.name);
	}

	for (const emoji of reactions) {
		try {await message.react(emoji);}
		catch (err) {console.error('reply-reaction: could not react with :' + emoji.name + ':', err.message);}
	}
};

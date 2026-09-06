// The bot muttering to itself.
//
// Every so often it says one of the lines from phrases.txt, in one channel.
// The gap between sayings is the configured average give or take 50%, so it
// never falls into a rhythm, and it keeps quiet if it has spoken - or anybody
// has quoted one of its phrases - in the recent history of the channel.

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import client from './client.js';
import { CONFIG } from './data.js';

const PHRASES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'phrases.txt');
const TICK_INTERVAL = 60 * 1000;

//how far back a phrase makes it hold its tongue entirely
const HISTORY_DEPTH = 10;

//how far back it looks for phrases to avoid repeating. one fetch covers both,
//so looking further than HISTORY_DEPTH costs nothing
const LOOKBACK_DEPTH = 30;

const DEFAULT_INTERVAL_MINUTES = 120;

//assert creates the key blank if it is missing, so it shows up in /config list
await CONFIG.assert('phrasesChannelId', false);

if (CONFIG.get('phrasesIntervalMinutes') === undefined || CONFIG.get('phrasesIntervalMinutes') === '')
	await CONFIG.set('phrasesIntervalMinutes', DEFAULT_INTERVAL_MINUTES);


// ------------------------------------------------------------ the lines

let phrases = [];

//re-read before every saying, so editing phrases.txt does not need a restart.
//a file that cannot be read leaves the last good list in place
async function loadPhrases () {
	try {
		const lines = (await fs.readFile(PHRASES_FILE, 'utf-8'))
			.split(/\r?\n/)
			.map(line => line.trim())
			.filter(Boolean);

		if (lines.length) phrases = lines;
		else console.warn('phrases.txt has no phrases in it');
	}
	catch (err) {
		console.error('Could not read phrases.txt:', err.message);
	}

	return phrases;
}


// -------------------------------------------------------- the schedule

function intervalMinutes () {
	const minutes = Number(CONFIG.get('phrasesIntervalMinutes'));
	if (!Number.isFinite(minutes) || minutes <= 0) return DEFAULT_INTERVAL_MINUTES;
	return minutes;
}


//the next saying is due somewhere between half and one and a half times the
//average, so nobody can set their watch by it
async function scheduleNextPhrase () {
	const minutes = intervalMinutes() * (0.5 + Math.random());
	const at = new Date(Date.now() + minutes * 60 * 1000);

	console.log('Next phrase due', at.toISOString(), '(in', Math.round(minutes), 'minutes)');
	await CONFIG.set('nextPhraseAt', at.toISOString());
}


// ------------------------------------------------------------- speaking

//The last few things it said, for a channel busy enough that they have already
//scrolled out of the lookback. It remembers half of phrases.txt - long enough
//that repeats are rare, short enough that there is always plenty left to pick
//from however few phrases there are.
const recentlySaid = [];

function remember (phrase) {
	recentlySaid.push(phrase);
	const keep = Math.max(1, Math.floor(phrases.length / 2));
	while (recentlySaid.length > keep) recentlySaid.shift();
}


function normalize (text) {
	return String(text || '').trim().toLowerCase();
}


//newest first. discord hands them back that way already, but the two rules
//below both depend on the order, so it is worth being sure of
async function recentMessages (channel) {
	const fetched = await channel.messages.fetch({limit: LOOKBACK_DEPTH});

	return [...fetched.values()]
		.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
		.map(message => ({
			content: normalize(message.content),
			mine: Boolean(client.user) && message.author?.id === client.user.id,
		}));
}


async function saySomething () {
	const channelId = CONFIG.get('phrasesChannelId');
	if (!channelId) return;

	await loadPhrases();
	if (!phrases.length) return;

	const channel = await client.channels.fetch(channelId);
	if (!channel?.isTextBased?.()) {
		console.warn('phrasesChannelId is not a channel the bot can talk in:', channelId);
		return;
	}

	const history = await recentMessages(channel);
	const spoken = new Set(phrases.map(normalize));

	//its own posts count whatever they say, rather than only when they still
	//match a line in phrases.txt - rewording a phrase must not make the copy it
	//already posted invisible. anybody else repeating a phrase counts too, since
	//the channel has seen it either way
	const blocking = history.slice(0, HISTORY_DEPTH).find(message => message.mine || spoken.has(message.content));

	if (blocking) {
		console.log((blocking.mine ? 'It spoke' : 'Somebody else said one of its phrases') + ' within the last ' + HISTORY_DEPTH + ' messages - keeping quiet');
		return;
	}

	//anything said lately is off the table. the history half of this survives a
	//restart, which is the half the in-memory list cannot do
	const avoid = new Set([...history.map(message => message.content), ...recentlySaid.map(normalize)]);
	const pool = phrases.filter(phrase => !avoid.has(normalize(phrase)));

	//a phrases.txt short enough to have run out still gets to say something
	const choices = pool.length ? pool : phrases;
	const phrase = choices[Math.floor(Math.random() * choices.length)];

	console.log('Saying:', phrase, '(picked from', choices.length, 'of', phrases.length + ')');
	await channel.send(phrase);
	remember(phrase);
}


// ----------------------------------------------------------------- tick

async function tick () {
	try {
		if (!CONFIG.get('phrasesChannelId')) return;

		const due = new Date(CONFIG.get('nextPhraseAt') || '').getTime();

		//first tick after the channel is set - start the clock rather than
		//immediately blurting something out
		if (Number.isNaN(due)) return await scheduleNextPhrase();

		//a gap scheduled while the average was higher could be hours too long
		//to wait out, so pull it back in when the setting is turned down
		if (due - Date.now() > intervalMinutes() * 1.5 * 60 * 1000) return await scheduleNextPhrase();

		if (due > Date.now()) return;

		//rescheduled before it speaks, so a failure cannot retry every minute
		await scheduleNextPhrase();

		await saySomething();
	}
	catch (err) {console.error('Phrase tick failed', err);}
}


function startTicking () {
	console.log('Sentience running -', phrases.length, 'phrases loaded');
	tick();
	setInterval(tick, TICK_INTERVAL);
}

await loadPhrases();

if (client.isReady?.()) startTicking();
else client.once('ready', startTicking);

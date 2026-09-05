// Says in a thread when the bot comes up, and when it falls over.
//
// A crash report is only as useful as the log around it, so console output is
// kept in a ring buffer and attached to the report as a file. Some deaths -
// out of memory, the host going away, a kill -9 - never reach a handler at all,
// so each run also leaves a marker behind that the next run checks, and reports
// on if the last one never got to tidy it up.
//
// Imported before anything else in bot.js, so it is watching from the start.

import { format } from 'node:util';
import { AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { describeDuration, describePreviousRun, buildCrashLog } from './util/status-report.js';

const STATE_FILE = path.join('_data', 'last-run.json');
const LOG_LINES = 600;
const MAX_LOG_BYTES = 1024 * 1024;
const POST_TIMEOUT = 8000;

const COLOR_UP = 0x43b581;
const COLOR_CRASH = 0xed4245;
const COLOR_UNCLEAN = 0xfaa61a;

const startedAt = Date.now();
const recentLogs = [];

let previousRun = null;
let handlingCrash = false;


// ------------------------------------------------ keeping the recent log

function remember (level, args) {
	try {
		recentLogs.push(new Date().toISOString() + ' [' + level + '] ' + format(...args));
		if (recentLogs.length > LOG_LINES) recentLogs.shift();
	}
	catch (err) {/*a logger that throws is worse than no logger*/}
}

for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
	const original = console[level].bind(console);
	console[level] = (...args) => {
		remember(level, args);
		original(...args);
	};
}


// ------------------------------------------------ the marker between runs

//written synchronously so it survives a process that dies immediately after
function readPreviousRun () {
	try {return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));}
	catch (err) {return null;}
}

function writeRun (state) {
	try {
		fs.mkdirSync('_data', {recursive: true});
		fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, '\t'));
	}
	catch (err) {
		//never let bookkeeping take the bot down
		console.error('Could not write the run marker', err);
	}
}

previousRun = readPreviousRun();
writeRun({startedAt: new Date(startedAt).toISOString(), pid: process.pid, stoppedAt: null, reason: null, by: null});


// Called on the way out so the next run knows this was deliberate. Anything
// that does not get to call this is reported as an unclean shutdown.
export function recordStop (reason, by = null) {
	writeRun({
		startedAt: new Date(startedAt).toISOString(),
		pid: process.pid,
		stoppedAt: new Date().toISOString(),
		reason,
		by,
	});
}


// ------------------------------------------------------------- posting

async function getStatusThread () {
	const {CONFIG} = await import('./data.js');
	const threadId = CONFIG.get('statusThreadId');
	if (!threadId) return null;

	const {default: client} = await import('./client.js');
	if (!client.isReady()) return null;

	const channel = await client.channels.fetch(threadId);
	if (!channel) return null;

	//an idle thread archives itself, and archived threads reject new messages
	if (channel.isThread?.() && channel.archived) await channel.setArchived(false);

	return channel;
}


//never let a status post hang the shutdown it is reporting on
async function post (message) {
	try {
		const thread = await Promise.race([
			getStatusThread(),
			new Promise(resolve => setTimeout(() => resolve(null), POST_TIMEOUT)),
		]);

		if (!thread) return false;

		await Promise.race([
			thread.send(message),
			new Promise((resolve, reject) => setTimeout(() => reject(new Error('timed out')), POST_TIMEOUT)),
		]);

		return true;
	}
	catch (err) {
		console.error('Could not post to the status thread:', err.message);
		return false;
	}
}


export async function announceStartup () {
	const previous = describePreviousRun(previousRun, startedAt);

	await post({
		embeds: [{
			title: 'Lospec Bot is online',
			description: previous.text,
			color: previous.clean ? COLOR_UP : COLOR_UNCLEAN,
			footer: {text: 'pid ' + process.pid + ' · node ' + process.version},
			timestamp: new Date().toISOString(),
		}],
	});
}


// ---------------------------------------------------------- crash reports

function crashLog (label, error) {
	return buildCrashLog({label, error, startedAt, logs: recentLogs, pid: process.pid, maxBytes: MAX_LOG_BYTES});
}


async function reportCrash (label, error) {
	//a crash while reporting a crash must not loop
	if (handlingCrash) return;
	handlingCrash = true;

	console.error('FATAL —', label, error);
	recordStop('crash');

	const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const message = String(error?.message || error).slice(0, 1000);

	await post({
		embeds: [{
			title: 'Lospec Bot has crashed',
			description: '**' + label + '**\n```\n' + message + '\n```',
			color: COLOR_CRASH,
			footer: {text: 'ran for ' + describeDuration(Date.now() - startedAt) + ' · pid ' + process.pid},
			timestamp: new Date().toISOString(),
		}],
		files: [new AttachmentBuilder(Buffer.from(crashLog(label, error), 'utf-8'), {name: 'crash-' + stamp + '.log'})],
	});

	process.exit(1);
}


process.on('uncaughtException', error => reportCrash('Uncaught exception', error));
process.on('unhandledRejection', error => reportCrash('Unhandled promise rejection', error));

//a supervisor stopping the bot is not a crash, and should not be reported as one
for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		console.log('Received ' + signal + ', shutting down');
		recordStop('signal');
		process.exit(0);
	});
}


// ----------------------------------------------------------------- boot

//creates the key blank if it is missing, so it shows up in /config list config
const {CONFIG} = await import('./data.js');
await CONFIG.assert('statusThreadId', false);

const {default: client} = await import('./client.js');

if (client.isReady()) announceStartup();
else client.once('ready', announceStartup);

// Plays the music library into a voice channel, one channel per server.
//
// A session plays requested songs first, in the order they were asked for, and
// otherwise works through its station in a shuffled order, reshuffling once
// every song has had a turn. Each song is announced in the voice channel's chat
// as it starts.
//
// That chat is the only place anything about the music is posted publicly.
// Commands can be used from any channel, but elsewhere they only get an
// ephemeral reply.
//
// When nobody but bots is left in the channel, the session ends after
// LEAVE_DELAY unless somebody comes back.

import {
	joinVoiceChannel, createAudioPlayer, createAudioResource, entersState,
	AudioPlayerStatus, VoiceConnectionStatus, StreamType, NoSubscriberBehavior,
} from '@discordjs/voice';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import client from '../client.js';
import { STATIONS, listSongs, loadLibrary, readSong, levelOf, measureSong, onLibraryChange, watchLibrary, code } from './music-library.js';
import { levelFilter } from './music-audio.js';

const LEAVE_DELAY = 60 * 1000;
const LIBRARY_REFRESH = 5 * 60 * 1000;
const CONNECT_TIMEOUT = 20 * 1000;

// guildId -> session
const sessions = new Map();

loadLibrary();
watchLibrary(LIBRARY_REFRESH);

// New songs are slotted into the current shuffle at random, so they come up
// within this pass through the station rather than after it. Removed ones are
// taken out of everything that was going to play them.
onLibraryChange(({added, removed}) => {
	for (const session of sessions.values()) {
		for (const song of added) {
			if (song.station !== session.station || !session.shuffled.length) continue;
			session.shuffled.splice(Math.floor(Math.random() * (session.shuffled.length + 1)), 0, song);
		}
		for (const song of removed) forgetSong(session, song);
	}
});

export function getSession (guildId) {
	return sessions.get(guildId);
}

// Joins (or moves to) a voice channel, and starts playing if nothing is.
// A requested song is queued before anything starts, so it plays first.
export async function join (voiceChannel, station, song) {
	let session = sessions.get(voiceChannel.guild.id);

	if (!session) {
		session = {
			guildId: voiceChannel.guild.id,
			station: station || 'chill',
			queue: [],
			shuffled: [],
			current: null,
			ffmpeg: null,
			leaveTimer: null,
			ended: false,
			player: createAudioPlayer({behaviors: {noSubscriber: NoSubscriberBehavior.Play}}),
		};
		session.player.on(AudioPlayerStatus.Idle, () => { if (!session.ended) playNext(session); });
		session.player.on('error', err => console.error('music player error on', session.current?.name, err.message));
		sessions.set(session.guildId, session);
	}

	const switching = Boolean(station && station !== session.station);
	if (switching) {
		session.station = station;
		session.shuffled = [];
	}

	session.channelId = voiceChannel.id;
	if (song) session.queue.push(song);

	if (session.connection?.joinConfig.channelId !== voiceChannel.id) {
		const connection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: voiceChannel.guild.id,
			adapterCreator: voiceChannel.guild.voiceAdapterCreator,
			selfDeaf: true,
		});

		if (connection !== session.connection) {
			session.connection = connection;
			connection.subscribe(session.player);
			connection.on(VoiceConnectionStatus.Disconnected, async () => {
				// being dragged to another channel disconnects briefly and then reconnects
				try {
					await Promise.race([
						entersState(connection, VoiceConnectionStatus.Signalling, 5000),
						entersState(connection, VoiceConnectionStatus.Connecting, 5000),
					]);
				}
				catch (err) { if (session.connection === connection) leave(session.guildId); }
			});
		}

		try { await entersState(connection, VoiceConnectionStatus.Ready, CONNECT_TIMEOUT); }
		catch (err) {
			leave(session.guildId);
			throw new Error('Could not connect to ' + voiceChannel.toString() + '.');
		}
	}

	checkListeners(session);
	if (!session.current || switching) skip(session);
	return session;
}

// Adds a song to the end of the requests. Returns how many songs play before
// it, or -1 if it is playing now.
export function enqueue (session, song) {
	session.queue.push(song);
	if (session.player.state.status === AudioPlayerStatus.Idle) {
		skip(session);
		return -1;
	}
	return session.queue.length - 1;
}

// Moves on to the next song - stopping the current one does that, and when
// nothing is playing there is nothing to stop, so it starts one directly
export function skip (session) {
	if (session.player.state.status === AudioPlayerStatus.Idle) playNext(session);
	else {
		stopConverting(session);
		session.player.stop(true);
	}
}

export function setStation (session, station) {
	session.station = station;
	session.shuffled = [];
	skip(session);
}

export function leave (guildId) {
	const session = sessions.get(guildId);
	if (!session) return;
	session.ended = true;
	sessions.delete(guildId);
	clearTimeout(session.leaveTimer);
	stopConverting(session);
	session.player.stop(true);
	if (session.connection?.state.status !== VoiceConnectionStatus.Destroyed) session.connection?.destroy();
}

function forgetSong (session, song) {
	const isSong = other => other.id === song.id && other.name === song.name;
	session.queue = session.queue.filter(other => !isSong(other));
	session.shuffled = session.shuffled.filter(other => !isSong(other));
}

// The requested songs still to play, in order
export function upcoming (session) {
	return [...session.queue];
}

// Songs are downloaded whole before they start. ffmpeg converts faster than
// they play, so streaming one from the CDN leaves the connection idle while the
// player catches up, and the CDN drops it partway through the song.
//
// Each song is turned up or down to the same loudness as it plays. A song that
// has never been measured is measured first, which only happens once.
async function playNext (session) {
	if (session.advancing) return;
	session.advancing = true;
	let song, audio, level;
	try {
		await loadLibrary();
		for (let attempt = 0; attempt < 3 && !session.ended; attempt++) {
			song = session.queue.shift() || nextFromStation(session);
			if (!song) break;
			try {
				audio = await readSong(song);
				level = levelOf(song) || await measureSong(song, audio).catch(err => {
					console.error('could not measure', song.name + ':', err.message);
					return null;
				});
				break;
			}
			catch (err) {
				console.error('could not download', song.name + ':', err.message);
				song = null;
			}
		}
	}
	finally { session.advancing = false; }
	if (session.ended) return;

	session.current = song;
	stopConverting(session);

	if (!song) {
		await announce(session, listSongs(session.station).length
			? 'The ' + STATIONS[session.station] + ' station could not be played.'
			: 'The ' + STATIONS[session.station] + ' station has no songs.');
		return;
	}

	const filter = levelFilter(level);
	const ffmpeg = spawn(ffmpegPath, [
		'-loglevel', 'error',
		'-i', 'pipe:0',
		'-vn',
		...(filter ? ['-af', filter] : []),
		'-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2',
		'-f', 'ogg', 'pipe:1',
	], {stdio: ['pipe', 'pipe', 'pipe']});
	//a song cut short makes ffmpeg complain about its output closing, which
	//is expected, so only the current one is listened to
	ffmpeg.stderr.on('data', data => { if (session.ffmpeg === ffmpeg) console.error('ffmpeg:', song.name, data.toString().trim()); });
	ffmpeg.on('error', err => console.error('ffmpeg failed to start:', err.message));
	ffmpeg.stdin.on('error', () => {});
	ffmpeg.stdout.on('error', () => {});
	ffmpeg.stdin.end(audio);
	session.ffmpeg = ffmpeg;

	session.player.play(createAudioResource(ffmpeg.stdout, {inputType: StreamType.OggOpus}));
	await announce(session, '🎵 ' + code(song.name));
}

// Ends the conversion of the song that is playing, before the player lets go
// of its output
function stopConverting (session) {
	session.ffmpeg?.kill();
	session.ffmpeg = null;
}

function nextFromStation (session) {
	if (session.shuffled.length === 0) {
		const songs = [...listSongs(session.station)];
		for (let i = songs.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[songs[i], songs[j]] = [songs[j], songs[i]];
		}
		// don't play the same song twice in a row across a reshuffle
		if (songs.length > 1 && songs[0].id === session.current?.id) songs.push(songs.shift());
		session.shuffled = songs;
	}
	return session.shuffled.shift();
}

// Posts in the voice channel's own chat
async function announce (session, content) {
	const channel = client.channels.cache.get(session.channelId);
	try { return await channel.send({content, allowedMentions: {parse: []}}); }
	catch (err) { console.warn('could not post in the music channel:', err.message); }
}

// Replies to a command with something everybody listening should know. Used
// from the voice channel's chat, that is a normal reply; from anywhere else it
// is posted in the voice channel's chat, and the reply is only seen by the
// person who used the command.
export async function reply (interaction, session, content) {
	if (interaction.channelId === session.channelId)
		return interaction.reply({content, allowedMentions: {parse: []}});
	await announce(session, content);
	await interaction.reply({content, ephemeral: true, allowedMentions: {parse: []}});
}

// Starts or cancels the countdown to leaving, depending on whether anybody
// other than bots is in the channel
function checkListeners (session) {
	const channel = client.channels.cache.get(session.channelId);
	const listeners = channel ? channel.members.filter(member => !member.user.bot).size : 0;

	if (listeners > 0) {
		clearTimeout(session.leaveTimer);
		session.leaveTimer = null;
	}
	else if (!session.leaveTimer) {
		session.leaveTimer = setTimeout(() => leave(session.guildId), LEAVE_DELAY);
	}
}

client.on('voiceStateUpdate', (oldState, newState) => {
	const session = sessions.get(newState.guild.id);
	if (!session) return;
	if (newState.id === client.user.id && newState.channelId && newState.channelId !== session.channelId)
		session.channelId = newState.channelId;
	checkListeners(session);
});

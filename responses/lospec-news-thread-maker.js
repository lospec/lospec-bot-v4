import {CONFIG} from '../data.js';
import {ThreadAutoArchiveDuration} from 'discord.js';

await CONFIG.assert('heartEmoji');

const CHANNEL_NAME = 'lospec-news';

export const filter = async (message) => {
	if (message.channel.name !== CHANNEL_NAME) return false;


	return true;
}

export const execute = async (message) => {
	console.log('creating lospec news thread:', 'https://discord.com/channels/'+message.guild.id+'/'+message.channel.id+'/'+message.id);

	let title = extractTitle(message.content);

	await message.startThread({
		name: title + ' - Lospec News',
		autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek
	});
}

function extractTitle(content) {
	try {
		let lines =  content.split('\n');
		let firstLine = lines[0];
		firstLine = firstLine.replace(/^#+ /, ''); //remove # 
		return firstLine;
	}
	catch (e) {
		console.error('failed to extract title for lospec news:',e);
		return 'Lospec News';
	}
}

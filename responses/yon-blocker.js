import {YON_CONFIG} from '../data.js';

export const filter = async (message) => {
	let dungeonChannelId = YON_CONFIG.get('dungeon-channel-id');
	if (message.author.bot) 
		return false;
	if (message.channel.id != dungeonChannelId) 
		return false;
	else 
		return true;
}

export const execute = async (message) => {
	await message.delete();
}
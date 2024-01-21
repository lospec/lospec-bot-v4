import { MessageFlags } from 'discord.js';
import {CONFIG} from '../data.js';

await CONFIG.assert('heartEmoji');

const ART_CHATS_CATEGORY_NAME = 'Art Chats';

export const filter = async (message) => {
	if (message.channel.parent.name != ART_CHATS_CATEGORY_NAME) return false;
	if (message.attachments.size == 0) return false;
	return true;
}

export const execute = async (message) => {
	console.log('adding heart reaction to art-chats message:', 'https://discord.com/channels/'+message.guild.id+'/'+message.channel.id+'/'+message.id);
	await message.react(CONFIG.get('heartEmoji'));
}
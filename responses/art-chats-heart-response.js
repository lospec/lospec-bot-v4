import { MessageFlags } from 'discord.js';
import {CONFIG} from '../data.js';

await CONFIG.assert('heartEmoji');

const ART_CHATS_CATEGORY_NAME = 'Art Chats';
const LOSPEC_DAILIES_CHANNEL_NAME = 'lospec-dailies';

export const filter = async (message) => {
	if (!message.channel.parent) return false;
	let isWithinArtChats = (message.channel.parent.name == ART_CHATS_CATEGORY_NAME);
	let isInLospecDailiesChannel = (message.channel.name == LOSPEC_DAILIES_CHANNEL_NAME);
	let hasAttachments = (message.attachments.size > 0);
	let hasEmbeds = (message.embeds.length > 0);

	if (!isWithinArtChats && !isInLospecDailiesChannel) return false;
	if (!hasAttachments && !hasEmbeds) return false;

	return true;
}

export const execute = async (message) => {
	console.log('adding heart reaction to message:', 'https://discord.com/channels/'+message.guild.id+'/'+message.channel.id+'/'+message.id);
	await message.react(CONFIG.get('heartEmoji'));
}
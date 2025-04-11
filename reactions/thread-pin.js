import { MessageFlags } from 'discord.js';
import {CONFIG} from '../data.js';

// this should only work when a user reacts with a pin emoji to a message in a thread that they created
export const filter = async (reaction, user) => {
	// reaction is not a pin emoji
	if (reaction.emoji.name !== '📌') return false;
	// message is not in a thread
	if (!reaction.message.channel.isThread()) return false;
	// message is not in a thread that the user created
	if (reaction.message.channel.ownerId !== user.id) return false;
	// message is not in a thread that is not archived or locked
	if (reaction.message.channel.archived || reaction.message.channel.locked) return false;
	return true;
}

export const execute = async (reaction) => {
	console.log('pinning message', reaction.message.id, 'in thread', reaction.message.channel.id, 'by user', reaction.message.author.id);

	// pin the message
	await reaction.message.pin({ reason: 'Pinned by user in their own thread.' });
}
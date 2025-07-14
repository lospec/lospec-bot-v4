import { client } from '../client.js';
import { MEME_DATA } from '../data.js';

await MEME_DATA.assert('users','memesChannelId','roleId','minimumReactions');

export const filter = async (reaction) => {
	const users = await reaction.users.fetch();
	const reactionCount = users.size;

	// Ensure message is fully fetched to access attachments
	const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
	const hasAttachments = message.attachments.size > 0;

	// reaction is in the memes channel
	if (message.channel.id !== MEME_DATA.get('memesChannelId')) return false;

	// message has an image
	if (!hasAttachments) return false;

	// this reaction has enough reactions
	if (reactionCount < MEME_DATA.get('minimumReactions')) return false;

	return true;
}


// increment (or set to 1) the number of pinned memes for that user in the DATA
// check who has the role, and check who has the most pinned memes
// if the user with the most pinned memes does not have the role, remove the role from anyone that has it, then give it to the user with the most pinned memes
export const execute = async (reaction) => {

	console.log('pinning meme:', reaction.message.id, 'by', reaction.message.author.tag);

	const ROLE_ID = MEME_DATA.get('roleId');
	
	incrementPinnedMemes(reaction.message.author.id);
	pinTheMessage(reaction.message.id, reaction.message.channel.id);

	const currentRoleHolder = await getCurrentRoleHolder(reaction.message.channel.guild.id, ROLE_ID);
	const userWithMostPinnedMemes = await getUserWithMostPinnedMemes(reaction.message.channel.guild.id, ROLE_ID);

	if (currentRoleHolder !== userWithMostPinnedMemes) {
		await removeRoleFromAllMembers(reaction.message.channel.guild.id, ROLE_ID);
		await addRoleToMember(reaction.message.channel.guild.id, userWithMostPinnedMemes, ROLE_ID);
	}

}

function incrementPinnedMemes(userId) {
	const users = MEME_DATA.get('users');
	if (!users[userId]) {
		users[userId] = 1;
	} else {
		users[userId]++;
	}
	MEME_DATA.set('users', users);
}

async function pinTheMessage(messageId, channelId) {
	const channel = await client.channels.fetch(channelId);
	const message = await channel.messages.fetch(messageId);
	if (message.pinned) return;
	await message.pin({ reason: 'Pinned by user in their own thread.' });
	const pinnedMessages = await channel.messages.fetchPinned();
	if (pinnedMessages.size > 50) {
		const oldestPinnedMessage = pinnedMessages.last();
		await oldestPinnedMessage.unpin({ reason: 'Unpinned to make room for new pinned message.' });
	}
}

async function getCurrentRoleHolder(guildId, roleId) {
	const guild = await client.guilds.fetch(guildId);
	const membersWithRole = await guild.members.fetch({ role: roleId });
	if (membersWithRole.size > 0) {
		return membersWithRole.first().id;
	}
	return null;
}

//search DATA for the user id with the highest value and return it
async function getUserWithMostPinnedMemes(guildId, roleId) {
	const users = MEME_DATA.get('users');
	let userWithMostPinnedMemes = null;
	let mostPinnedMemes = 0;
	for (const userId in users) {
		if (users[userId] > mostPinnedMemes) {
			mostPinnedMemes = users[userId];
			userWithMostPinnedMemes = userId;
		}
	}
	return userWithMostPinnedMemes;
}

async function removeRoleFromAllMembers(guildId, roleId) {
	const guild = await client.guilds.fetch(guildId);
	const membersWithRole = await guild.members.fetch({ role: roleId });
	for (const member of membersWithRole.values()) {
		await member.roles.remove(roleId, 'Removed role from user with most pinned memes.');
	}
}

async function addRoleToMember(guildId, memberId, roleId) {
	const guild = await client.guilds.fetch(guildId);
	const member = await guild.members.fetch(memberId);
	await member.roles.add(roleId, 'Added role to user with most pinned memes.');
}


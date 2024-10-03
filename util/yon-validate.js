
//import data
import {YON_DATA, YON_CONFIG} from '../data.js';
import client from '../client.js';

export default async function yonValidate(interaction) {
	let dungeonMasterId = YON_CONFIG.get('dungeon-master-id');
	let dungeonChannelId = YON_CONFIG.get('dungeon-channel-id');

	if (!dungeonMasterId || !dungeonChannelId) {
		console.error('Yon Dungeon is not properly configured: ', {dungeonMasterId, dungeonChannelId});
		throw new Error('Yon Dungeon is not currently open.');
	}

	let dungeonChannel = await client.channels.fetch(dungeonChannelId);
	if (!dungeonChannel) {
		console.error('Failed to fetch dungeon channel:', dungeonChannelId);
		throw new Error('Yon Dungeon is not currently open.');
	}

	if (interaction.channel.id != dungeonChannelId) {
		throw new Error('You can only use this command in the Yon Dungeon thread!');
	}

	let user = await YON_DATA.get(interaction.user.id);
	console.log("falidate user ", user);
	if (!user) 
		throw new Error ('You are not in Yon Dugeon. Use the /yon-join command to begin.');
	
	return {user, dungeonChannel};
}
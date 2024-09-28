import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import client from '../client.js';

//import data
import {Data} from '../data.js';

const YON_DATA = new Data('yon');

const YON_CONFIG = new Data('yon-config');

export const config = {
	name: 'join-yon-dungeon', 
	description: 'Create a character and enter Yon Dungeon',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'character-name',
			description: 'The name of your character',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
		{
			name: 'character-avatar',
			description: 'An image to use as your character\'s avatar (optional, defaults to your discord avatar)',
			type: ApplicationCommandOptionType.Attachment,
			required: false,
		}
	]
};



export const execute = async (interaction) => {
	//get config
	let dungeonMasterId = YON_CONFIG.get('dungeon-master-id');
	let dungeonChannelId = YON_CONFIG.get('dungeon-channel-id');
	if (!dungeonMasterId || !dungeonChannelId) {
		console.error('Yon Dungeon is not properly configured: ', {dungeonMasterId, dungeonChannelId});
		return await interaction.reply({content: 'Yon Dungeon is not currently open.', ephemeral: true});
	}

	let user = await YON_DATA.get(interaction.user.id);
	if (user) return interaction.reply({content: 'You are already entered Yon Dungeon as '+ user.name, ephemeral: true});

	//get input
	let characterName = interaction.options.getString('character-name');
	let characterAvatar = interaction.options.getAttachment('character-avatar');
	if (characterAvatar) characterAvatar = characterAvatar.url;
	else characterAvatar = interaction.user.displayAvatarURL({dynamic: true, size: 128});

	//success
	await YON_DATA.set(interaction.user.id, {name: characterName, avatar: characterAvatar});
	await interaction.reply({content: 'You have entered the Yon Dungeon as '+characterName, ephemeral: true});

	//send join message in the dungeon channel
	let dungeonChannel = await client.channels.fetch(dungeonChannelId);
	if (!dungeonChannel) return console.error('Failed to fetch dungeon channel:', dungeonChannelId);
	await dungeonChannel.send({content: characterName+' entered Yon Dungeon.'});
}

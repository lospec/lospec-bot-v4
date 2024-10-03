import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import client from '../client.js';
import {YON_DATA,YON_CONFIG} from '../data.js';

export const config = {
	name: 'yon-join', 
	description: 'Create a character and enter Yon Dungeon',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'character-name',
			description: 'The name of your character',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
		// {
		// 	name: 'character-avatar',
		// 	description: 'An image to use as your character\'s avatar (optional, defaults to your discord avatar)',
		// 	type: ApplicationCommandOptionType.Attachment,
		// 	required: false,
		// }
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
		if (!characterName || characterName.length < 2) return interaction.reply({content: 'You must provide a character name.', ephemeral: true});
		if (characterName.length > 32) return interaction.reply({content: 'Character names must be 32 characters or less.', ephemeral: true});
		characterName = characterName.toUpperCase();
	let characterAvatar = interaction.options.getAttachment('character-avatar');
	if (characterAvatar) characterAvatar = characterAvatar.url;
	else characterAvatar = interaction.user.displayAvatarURL({dynamic: true, size: 128});

	//give user role
	let member = await interaction.guild.members.fetch(interaction.user.id);
	let role = await interaction.guild.roles.cache.find(role => role.id === YON_CONFIG.get('active-player-role'));
	await member.roles.add(role);

	//success
	let channelTag = '<#'+dungeonChannelId+'>';
	await YON_DATA.set(interaction.user.id, {
		name: characterName, 
		avatar: characterAvatar,
	});
	await interaction.reply({content: 'You have entered Yon Dungeon as '+characterName+'. Head to '+channelTag+' to begin your journey.', ephemeral: true});

	//send join message in the dungeon channel
	let dungeonChannel = await client.channels.fetch(dungeonChannelId);
	if (!dungeonChannel) return console.error('Failed to fetch dungeon channel:', dungeonChannelId);
	await dungeonChannel.send({embeds: [{description: '```'+characterName+' AWOKE IN YON DUNGEON```'}]});

}

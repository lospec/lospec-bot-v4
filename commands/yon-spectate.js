import { ApplicationCommandType } from 'discord.js';
import {YON_DATA,YON_CONFIG} from '../data.js';

export const config = {
	name: 'yon-spectate', 
	description: 'View the Yon Dungeon channel as a spectator, without joining',
	type: ApplicationCommandType.ChatInput,
};

export const execute = async (interaction) => {
	//get config
	
	let dungeonMasterId = YON_CONFIG.get('dungeon-master-id');
	let dungeonChannelId = YON_CONFIG.get('dungeon-channel-id');
	let channelTag = '<#'+dungeonChannelId+'>';
	if (!dungeonMasterId || !dungeonChannelId) {
		console.error('Yon Dungeon is not properly configured: ', {dungeonMasterId, dungeonChannelId});
		return await interaction.reply({content: 'Yon Dungeon is not currently open.', ephemeral: true});
	}

	let user = await YON_DATA.get(interaction.user.id);
	if (user) return interaction.reply({content: 'You are already entered Yon Dungeon as '+ user.name, ephemeral: true});


	//give user role
	let member = await interaction.guild.members.fetch(interaction.user.id);
	let role = await interaction.guild.roles.cache.find(role => role.id === YON_CONFIG.get('spectator-role'));
	
	//check if user already has the role
	if (member.roles.cache.has(role.id)) return interaction.reply({content: 'You are already spectating Yon Dungeon. Go to '+channelTag+' to see.', ephemeral: true});
	
	await member.roles.add(role);

	

	await interaction.reply({content: 'You should now be able to see '+channelTag+', and can read what happens. If you want to join the game as a character use the yon-join command.', ephemeral: true});
}
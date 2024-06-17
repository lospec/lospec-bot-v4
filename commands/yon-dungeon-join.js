import { ApplicationCommandType, ApplicationCommandOptionType} from 'discord.js';
import {CONFIG} from '../data.js';
import {Data} from '../data.js';


var players = new Data('yon-dungeon');

export const config = {
	name: 'join', 
	description: 'Enter Yon Dungeon', 
	type: ApplicationCommandType.ChatInput,
	options: [{
		name: 'name',
		type: ApplicationCommandOptionType.String,
		description: 'Your character\'s name',
		required: true
	}]
};

export const execute = async (interaction) => {
	let name = interaction.options.getString('name');
	let player = players.get(interaction.user.id);

	if (player) 
		return interaction.reply({ content: 'You are already in the dungeon as '+player, ephemeral: true });
	
	players.set(interaction.user.id, 'h');
	interaction.reply({ content: 'You entered the dungeon as '+name, ephemeral: true });
}
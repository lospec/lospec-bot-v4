import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import client from '../client.js';
import yonify from '../util/yonify.js';

//import data
import {Data} from '../data.js';

const YON_DATA = new Data('yon');

const YON_CONFIG = new Data('yon-config');

export const config = {
	name: 'yon', 
	description: 'Play Yon Dungeon - only works in the Yon Dungeon thread', 
	type: ApplicationCommandType.ChatInput,
	options: [
		//a dropdown list of options, either say, act, or chat, but not a subcommand
		{
			name: 'action',
			description: 'What to do in the Yon Dungeon',
			type: ApplicationCommandOptionType.String,
			required: true,
			choices: [
				{
					name: 'Say',
					value: 'say'
				},
				{
					name: 'Act',
					value: 'act'
				},
				{
					name: 'Chat',
					value: 'chat'
				}
			]
		},
		//a string option for the message to say
		{
			name: 'input',
			description: 'what you want to do or say',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	]
};

export const execute = async (interaction) => {
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
	if (!user) return interaction.reply({content: 'You are not in Yon Dugeon. Use the /join-yon-dungeon command to begin.', ephemeral: true});

	const subcommand = interaction.options.getString('action');
	let input = interaction.options.getString('input');

	if (commands.hasOwnProperty(subcommand)) {
		await commands[subcommand](interaction, user, input);
	}
}

const commands = {
	say: async function (interaction, user, input) {
		await interaction.reply({embeds: [{
			author: {
				name: user.name,
				icon_url: user.avatar
			},
			description: '```'+yonify('"'+input+'"')+'```'
		}]});
	},
	act: async function (interaction, user, input) {
		let rollScore = Math.floor(Math.random() * 20) + 1;

		await interaction.reply({embeds: [{
			description: '```'+yonify(user.name+' attempteth to '+input)+'```' + '\n' + ':game_die: '+rollScore
		}]});
	},
	chat: async function (interaction, user, input) {
		let userPing = '<@'+interaction.user.id+'>';
		let safeInput = input.replace(/\|/g, '\\|');
		await interaction.reply('||'+userPing+' / '+user.name+': '+safeInput+'||');
	}
};



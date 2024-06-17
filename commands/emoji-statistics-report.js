import { ApplicationCommandType, ApplicationCommandOptionType, ChannelType} from 'discord.js';
import client from '../client.js';

export const config = {
	name: 'emoji-statistics-report', 
	description: 'Generate a report of emoji usage', 
	type: ApplicationCommandType.ChatInput,
};

export const execute = async (interaction) => {
	let output = 'Generating emoji statistics report...\n\n';
	await interaction.reply({ content: output, ephemeral: true });

	let emojiStats = {};

	let channels = await getAllChannels(interaction.guild);
	//console.log('channels',channels);

	for (let channel of channels) {
		channel = channel[1];
		console.log('channel', channel.id, channel.name);
		//let stats = await getEmojiStatsFromChannel(channel);
		
	}
}	

async function getEmojiStatsFromChannel (channel) {
	let page = 1;
	let lastMessageId = null;
	while (true) {
		let messages = await interaction.channel.messages.fetch({limit: 100, before: lastMessageId});
		if (messages.size == 0) break;
		
		//loop through messages
		messages.forEach(m => {
			console.log('message',m);
		});

		page++;
		lastMessageId = messages.last().id;
		if (messages.size < 100) break;
	} 
}

async function getAllChannels (guild) {
	let channels = [];
	let allChannels = Array.from(await guild.channels.fetch());

	console.log('fetched',allChannels.length,'channels');

	//console.log('allChannels',allChannels);

	for (let channel of allChannels) {
		channel = channel[1];
		if (channel.type == ChannelType.GuildForum) {
			console.log('getting threads from forum', channel.name);

			// let poop = await channel.threads.fetch();
			// console.log('poop',Array.from(poop.threads));

			let threads = await channel.threads.fetch({archived: {fetchAll: true}});
			threads = Array.from(threads.threads);

			console.log('found',threads.length,'threads in forum');

			let subChannels = Array.from((await channel.threads.fetch({archived: {fetchAll: true}}).threads));
			console.log('forum threads',subChannels.length);
			channels.push(...subChannels);
		}
	}

	return channels;
}

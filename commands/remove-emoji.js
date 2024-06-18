import { ApplicationCommandType, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import client from '../client.js';
import { checkIfUserCanAfford, takeUsersMoney } from '../util/lozpekistan-bank.js';
import { getEmojiOnServer, removeEmojiFromServer } from '../util/emoji.js';
import {CONFIG} from '../data.js';

const PRICE = 50;

export const config = {
	name: 'remove-emoji', 
	description: 'Remove an emoji from this server (costs '+PRICE+'P)', 
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'emoji',
			description: 'The name of an emoji to remove (must match an emoji in this server)',
			type: ApplicationCommandOptionType.String,
			required: true,
		}
	]
};

const confirmationActionRow = {
	type: 1,
	components: [
		{
			type: 2,
			style: 1,
			label: 'Remove Emoji',
			customId: 'remove_emoji_confirm'
		},
		{
			type: 2,
			style: 2,
			label: 'Cancel',
			customId: 'remove_emoji_cancel'
		}
	]
};


export const execute = async (interaction) => {
	const emojiName = interaction.options.getString('emoji');
	let emoji;

	try {
		await checkIfUserCanAfford(interaction.user.id, PRICE);
		emoji = await getEmojiOnServer(interaction.guild, emojiName);
	}
	catch (err) {
		console.log('remove emoji request failed:',err);
		await interaction.reply({content: "Failed to remove emoji. " + err.message, ephemeral: true});
		return;
	}

	const embed = {
		title: 'Confirm Purchase',
		description: 'You are removing the emoji `:'+emojiName+':` from the server. \n\n This will cost you **'+PRICE+'P**. \n\n Are you sure you wish to do this?',
		thumbnail: {url: 'https://cdn.discordapp.com/emojis/'+emoji.id+'.png'},
		author: {name: ':'+emojiName+':'},
	};

	await interaction.reply({
		embeds: [embed],
		components: [confirmationActionRow],
	});
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;

	if (interaction.customId === 'remove_emoji_confirm') 
		confirmRemoveEmoji(interaction);
	else if (interaction.customId === 'remove_emoji_cancel')
		interaction.deleteReply();
});

async function confirmRemoveEmoji(interaction) {
	try {
		const emojiName = interaction.message.embeds[0].author.name.replace(/:/g,'');
			console.log('removing emoji:',emojiName);

		//checks
		await checkIfUserCanAfford(interaction.user.id, PRICE);
		await getEmojiOnServer(interaction.guild, emojiName);

		//make it happen
		await takeUsersMoney(interaction.user.id, PRICE);
		await removeEmojiFromServer(interaction, emojiName);

		await interaction.reply({content: "The `:"+emojiName+":` emoji has been successfully removed from the server. You monster.", ephemeral: true});
	
		const announcementChannel = await client.channels.fetch(CONFIG.get('emojiChangesAnnouncementsChannelId'));
		await announcementChannel.send({content: '💀 '+interaction.user.toString()+' has killed the `:'+emojiName+':` emoji.'});
	}
	catch (err) {
		console.log('add emoji request failed:',err);
		await interaction.reply({content: "Failed to remove emoji. " + err.message, ephemeral: true});
		return;
	}
}


import client from '../../client.js';
import { checkIfUserCanAfford, takeUsersMoney } from '../../util/lozpekistan-bank.js';
import { getEmojiOnServer, removeEmojiFromServer, checkIfEmojiIsRemovable } from '../../util/emoji.js';
import { EMOJI_DATA } from '../../data.js';

await EMOJI_DATA.assert('removeEmojiPrice');
const PRICE = EMOJI_DATA.get('removeEmojiPrice'); 

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


export default async (interaction) => {
	const emojiName = interaction.options.getString('emoji');
	let emoji;
    

	try {
		await checkIfUserCanAfford(interaction.user.id, PRICE);
		await checkIfEmojiIsRemovable(emojiName);
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
		ephemeral: true
	});
}

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;

	if (interaction.customId === 'remove_emoji_confirm') 
		confirmRemoveEmoji(interaction);
	else if (interaction.customId === 'remove_emoji_cancel')
		interaction.update({content: 'Remove emoji request cancelled.', embeds: [], components: [], attachments: []});
});

async function confirmRemoveEmoji(interaction) {
	try {
		const emojiName = interaction.message.embeds[0].author.name.replace(/:/g,'');
			console.log('removing emoji:',emojiName);

		//checks
		await checkIfUserCanAfford(interaction.user.id, PRICE);
		await getEmojiOnServer(interaction.guild, emojiName);
		await checkIfEmojiIsRemovable(emojiName);

		//make it happen
		await takeUsersMoney(interaction.user.id, PRICE);
		await removeEmojiFromServer(interaction, emojiName);
		
		interaction.update({content: "The `:"+emojiName+":` emoji has been successfully removed from the server. You monster.", embeds: [], components: [], attachments: []});

		const announcementChannel = await client.channels.fetch(EMOJI_DATA.get('emojiChangesAnnouncementsChannelId'));
		await announcementChannel.send({content: '💀 '+interaction.user.toString()+' has killed the `:'+emojiName+':` emoji.'});

		let emojis = await EMOJI_DATA.get('emojis') || [];
		emojis = emojis.filter(e => e.name !== emojiName);
		await EMOJI_DATA.set('emojis', emojis);
	}
	catch (err) {
		console.log('add emoji request failed:',err);
		await interaction.update({content: "Failed to remove emoji. " + err.message, embeds: [], components: [], attachments: []});
		return;
	}
}


import { ApplicationCommandType, ActionRowBuilder, ModalBuilder, TextInputStyle, TextInputBuilder  } from 'discord.js';
import client from '../client.js';
import yonify from '../util/yonify.js';

export const config = {
	name: 'yon-describe',
	type: ApplicationCommandType.Message
};


export const execute = async (interaction) => {

	//let messageId = interaction.message.id;
	const modal = new ModalBuilder()
		.setCustomId('yond#')
		.setTitle('Describe Result of Action');
	const actionResponseInput = new TextInputBuilder()
		.setCustomId('action-response')
		.setLabel("What happened in response to this action: ")
		.setStyle(TextInputStyle.Paragraph);
	const firstActionRow = new ActionRowBuilder().addComponents(actionResponseInput);
	modal.addComponents(firstActionRow);

	await interaction.showModal(modal);
	let ess = await interaction.awaitModalSubmit();
	console.log('ess', ess);
};


//respond to the modal submission
client.on('interactionCreate', async interaction => {
	if (!interaction.isModalSubmit()) return;
	console.log('interaction', interaction.customId);
	if (interaction.customId !== 'yond#') return;

	console.log('isFromMessage? ', interaction.isFromMessage());

	let actionResponse = interaction.fields.getTextInputValue('action-response');

	let message = interaction.message;
	console.log('message', message);

	await interaction.reply({
		embeds: [{
			description: "```" + yonify(actionResponse) + "```"
		}],
	});

});	


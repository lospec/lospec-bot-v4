import { ApplicationCommandType, ActionRowBuilder, ModalBuilder, TextInputStyle, TextInputBuilder  } from 'discord.js';
import client from '../client.js';
import yonify from '../util/yonify.js';
import {YON_DATA,YON_CONFIG} from '../data.js';


export const config = {
	name: 'yon-describe',
	type: ApplicationCommandType.Message
};


export const execute = async (interaction) => {
	const modal = new ModalBuilder()
		.setCustomId('yond#')
		.setTitle('Describe Result of Action');
	const actionResponseInput = new TextInputBuilder()
		.setCustomId('action-response')
		.setLabel("What happened in response to this action: ")
		.setStyle(TextInputStyle.Paragraph)
		.setValue('skeddles succeeded or failed')
	const damageDoneInput = new TextInputBuilder()
		.setCustomId('damage-done')
		.setLabel('How much damage was done?')
		.setStyle(TextInputStyle.Short)
		.setValue('0');
	const itemsGainedInput = new TextInputBuilder()
		.setCustomId('items-gained')
		.setLabel('What items were gained?')
		.setStyle(TextInputStyle.Short)
		.setRequired(false)
		.setPlaceholder('comma separated list');
	const firstActionRow = new ActionRowBuilder().addComponents(actionResponseInput);
	const firstActionRow2 = new ActionRowBuilder().addComponents(damageDoneInput);
	const firstActionRow3 = new ActionRowBuilder().addComponents(itemsGainedInput);
	modal.addComponents(firstActionRow, firstActionRow2, firstActionRow3);

	try {
		await interaction.showModal(modal);
		let modalSubmitInteraction = await interaction.awaitModalSubmit({
			filter: (i) =>
			  i.customId === "yond#" &&
			  i.user.id === interaction.user.id,
			time: 60000,
		});
		await respondWithDescription(interaction, modalSubmitInteraction);

		console.log('modal submission', modalSubmitInteraction);
		modalSubmitInteraction.reply({content: 'Your response has been recorded.', ephemeral: true});
	} catch (e) {
		console.error('modal error', e);
	}
};

async function respondWithDescription (interaction, ModalSubmitInteraction) {
	let actionResponse = ModalSubmitInteraction.fields.getTextInputValue('action-response');
	let damageDone = parseInt(ModalSubmitInteraction.fields.getTextInputValue('damage-done'));
	let itemsGained = ModalSubmitInteraction.fields.getTextInputValue('items-gained');

	let output = "```" + yonify(actionResponse) + "```";

	if (!isNaN(damageDone) && damageDone > 0) 
		output += '\n :crossed_swords:  ' + damageDone;

	let itemsGainedArray = itemsGained.replace(/\s/g, '').split(',').filter(Boolean);
	if (itemsGainedArray.length > 0) 
	for (let item of itemsGainedArray) 
		output += '\n :package:  ' + item;

	const response = {
		embeds: [{
			description: output,
		}],
		reply: {
			messageReference: interaction.targetId
		}
	};

	await interaction.channel.send(response);
}


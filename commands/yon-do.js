import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import yonify from '../util/yonify.js';
import yonValidate from '../util/yon-validate.js';

export const config = {
	name: 'yon-do',
	description: 'Attempt to perform an action in Yon Dungeon',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'input',
			description: 'describe the action your character is attempting to perform (e.g. "jump over the chasm")',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	]
};

export const execute = async (interaction) => {
	let input = interaction.options.getString('input');
	let rollScore = Math.floor(Math.random() * 20) + 1;

	let {user} = await yonValidate(interaction);

	if (input.toLowerCase().startsWith('i ')) input = input.slice(2);

	await interaction.channel.send({embeds: [{
		description: '```'+yonify(user.name+' attempts to '+input)+'```' + '\n' + ':game_die: '+rollScore
	}]});

	await interaction.reply({content: '```"'+yonify('your action has been attempted')+'"```', ephemeral: true});
}
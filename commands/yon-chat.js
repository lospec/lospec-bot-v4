import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import yonify from '../util/yonify.js';
import yonValidate from '../util/yon-validate.js';

export const config = {
	name: 'yon-chat',
	description: 'speak outside of Yon Dungeon, as yourself',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'input',
			description: 'say whatever you want, ask meta questions or talk about the game',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	]
};

export const execute = async (interaction) => {
	let {user} = await yonValidate(interaction);
	let input = interaction.options.getString('input');
	let userPing = '<@'+interaction.user.id+'>';
	let safeInput = input.replace(/\|/g, '\\|');
	const text = '||**'+userPing+' ('+user.name+'):** '+safeInput+'||';
	await interaction.channel.send({content: text, allowedMentions: {parse: []}});
	await interaction.reply({content: '```"'+yonify('your message has been sent')+'"```', ephemeral: true});
}
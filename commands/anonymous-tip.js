import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { CONFIG } from '../data.js';
import client from '../client.js';

// Ensure the anonymous tip thread ID is configured
await CONFIG.assert('anonymous-tip-thread-id');

export const config = {
	name: 'anonymous-tip',
	description: 'Send an anonymous tip to the moderation team',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'message',
			description: 'Your anonymous tip message',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	]
};

export const execute = async (interaction) => {
	let message = interaction.options.getString('message');

	// Get the configured thread ID
	let tipThreadId = CONFIG.get('anonymous-tip-thread-id');
	
	if (!tipThreadId) {
		await interaction.reply({
			content: 'Anonymous tip feature is not properly configured. Please contact an administrator.',
			ephemeral: true
		});
		return;
	}

	try {
		// Fetch the thread/channel
		let tipThread = await client.channels.fetch(tipThreadId);
		
		if (!tipThread) {
			await interaction.reply({
				content: 'Could not find the anonymous tip thread. Please contact an administrator.',
				ephemeral: true
			});
			return;
		}

		// Send the anonymous tip with prefix
		await tipThread.send(`**ANONYMOUS TIP:** ${message}`);

		// Confirm to the user (ephemeral)
		await interaction.reply({
			content: 'Your anonymous tip has been sent successfully.',
			ephemeral: true
		});

	} catch (error) {
		console.error('Error sending anonymous tip:', error);
		await interaction.reply({
			content: 'Failed to send anonymous tip. Please try again or contact an administrator.',
			ephemeral: true
		});
	}
};

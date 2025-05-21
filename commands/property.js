import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { PROPERTY_CONFIG } from '../data.js';

await PROPERTY_CONFIG.assert('propertyUpdatesChannelId');

export const config = {
	name: 'property',
	description: 'Buy and upgrade your property!',
	type: ApplicationCommandType.ChatInput,
	options: [
		{
			name: 'buy',
			description: 'Buy a lot and start building your house',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'expand-width',
			description: 'Expand your house width',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'expand-height',
			description: 'Expand your house height',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'view',
			description: 'View your property',
			type: ApplicationCommandOptionType.Subcommand,
		}
	]
};

// Only export config and not execute or subcommand handlers
// Subcommand logic will be moved to separate files in ./commands/property/

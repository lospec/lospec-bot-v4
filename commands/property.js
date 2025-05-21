import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';
import { PROPERTY_CONFIG } from '../data.js';
import changeAccent from './property/change-accent.js';

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
		},
		{
			name: 'change-style',
			description: 'Change the style of your house',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'change-accent',
			description: 'Change the accent color of your house',
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: 'sell',
			description: 'Sell your property and get a refund for materials and land fees',
			type: ApplicationCommandOptionType.Subcommand,
		}
	]
};

// Only export config and not execute or subcommand handlers
// Subcommand logic will be moved to separate files in ./commands/property/

export default async function(interaction) {
	const sub = interaction.options.getSubcommand();
	switch (sub) {
		case 'buy': return (await import('./property/buy.js')).default(interaction);
		case 'expand-width': return (await import('./property/expand-width.js')).default(interaction);
		case 'expand-height': return (await import('./property/expand-height.js')).default(interaction);
		case 'view': return (await import('./property/view.js')).default(interaction);
		case 'change-style': return (await import('./property/change-style.js')).default(interaction);
		case 'change-accent': return changeAccent(interaction);
		case 'sell': return (await import('./property/sell.js')).default(interaction);
	}
}

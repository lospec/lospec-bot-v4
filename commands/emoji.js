import { ApplicationCommandType, ApplicationCommandOptionType } from 'discord.js';

export const config = {
    name: 'emoji',
    description: 'Manage server emojis',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'add',
            description: 'Add an emoji from the Lospec Emoji Archive to the server',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'emoji',
                    description: 'The emoji to add (must match an emoji in the Lospec Emoji Archive)',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: 'remove',
            description: 'Remove an emoji from this server',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'emoji',
                    description: 'The name of an emoji to remove (must match an emoji in this server)',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: 'update',
            description: 'Update an emoji on this server to the newest version',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'emoji',
                    description: 'The name of an emoji to update (must match an emoji in this server)',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: 'info',
            description: 'Get information about an emoji',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'emoji',
                    description: 'The name of the emoji to get info for',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: 'public',
                    description: 'Post the result publicly instead of just for you (default: false)',
                    type: ApplicationCommandOptionType.Boolean,
                    required: false,
                }
            ]
        }
    ]
};

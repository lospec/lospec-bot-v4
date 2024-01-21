# lospec-bot-v4

New version of discord bot, updated to latest version of discord.js and cleaner.

## Installation

`npm install`

## Dev

### Commands

Create a command that users can trigger

Add a file to the commands folder with the following exports:
- `config` - an object containing the JSON configuration for a command
- `execute` - a function that is called when the function is run (passes interaction as first argument)
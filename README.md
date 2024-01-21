# lospec-bot-v4

A bot created for the Lospec Discord server, with the source made available for community contributions or for learning to make your own similar bot.

This is version 4, rewritten from the ground up to use the latest version of discord.js and node modules. 

Not all of the functionality from [version 3](https://github.com/lospec/lospec-discord-bot) has been ported over, and the bots are both run concurrently.

# Installation

## Download

1. [Fork](https://guides.github.com/activities/forking/#fork) this project on Github
2. Locally [clone](https://guides.github.com/activities/forking/#clone) from your fork.
3. In a the project working directory run `npm install` to download the required nodeJS modules
4. (Optional) [Configure](https://github.com/git-guides/git-remote#git-remote) your local git repo to have the original repository as `upstream` so you can directly [pull](https://github.com/git-guides/git-pull) from it

## API Key

Make sure you have a discord server set-up where you have admin permissions before following these steps
1. Enter the [Discord Developer Portal](https://discord.com/developers/applications) and create a `New Application`. This will be your testing application.
2. With the Application created, select the `Bot` tab from the left panel. Choose `Add bot`.
3. Under the username, there will be a section labelled `token`, copy this to your clipboard
4. Create a file called `.env` on the root of the project
5. Add `DISCORD_BOT_TOKEN=` to the file, then paste the token afterwards and save

## Running

To run the bot, run the command `npm start` from the command line from the project root. 

# Dev

How to expand the bot with new functionality.

## Commands

Create a command that users can trigger

Add a file to the `./commands` folder with the following exports:
- `config` - an object containing the JSON configuration for a command
- `execute` - an async function that is called when the function is run (passes interaction as first argument)

## Responses

Respond to a message that matches a filter

Add a file to the `./responses` folder with the following exports:
- `filter` - an async function that checks if the message should trigger a response
- `execute` - an async function that is called when the filter matches
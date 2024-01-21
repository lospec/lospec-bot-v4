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

## Data Storage

If you have access to a mongodb database, you can set it up to match the production database, or you instead use the local datastore option which just uses .json files.

### MongoDB Database

1. Create a MongoDB database
2. Download your certificate and save it to `ca-certificate.crt`
3. Add `MONGO_URI=` to the .env file with your connection string, and append `&tlsCAFile=ca-certificate.crt` to the end
4. Add `DB=LospecBotV4` to the .env file 
5. Run the bot and it will automatically create the necessary tables and documents and the appropriate values
6. Edit the documents to fill in any blank values
7. Reboot the bot

Please note, if you update these documents manually by editing them, you must reboot the bot immediately for the changes to be recognizes. The data is stored in memory and overwrites the document whenever it's changed.


### Local Datastore

If you don't have access to a mongodb database, or find it too confusing to set up (understandably), you can just use the local option:

1. Add `LOCAL_DATA_STORAGE=true` to the .env file
2. Run the bot, and it will automatically create a `./_data` folder and the necessary .json files
3. Edit the documents to fill in any blank values
4. Reboot the bot

Please note, if you update these files manually by editing them, you must reboot the bot immediately for the changes to be recognizes. The data is stored in memory and overwrites the file whenever it's changed.

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

## Data Storage

To run the bot, you must have set up one of the two data storage options, explained above. Both options have identical APIs.

First you must import the appropriate document from the data module:

`import {CONFIG} from '../data.js';`

Modules that use a lot of properties should be set up with their own data store, which is defined in the data module:

`export const MYDATAMODULENAME = new Data('my-data-module-slug');`

### Methods

- **.get(** `<string>` key **)** - Get the value associated with the provided key
- **.set(** `<string>` key, `<any>` value **)** - Set the value of the provided key to the provided value
- **.assert(** `<string>` key, `<bool>` required *[optional]* **)** (async) - Ensure a value exists in the data store, and if not, create a blank value and throw an error (unless required is set to false). Must be awaited. This gives the developer a place to enter the value manually.
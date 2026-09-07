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

# Configuration

Everything the bot needs to be told — channel ids, prices, timings — lives in
the data stores rather than in code, and admins can read and change all of it
from discord with `/config`. The command is restricted to administrators, and
does not show up at all for anybody else.

| Command | |
| --- | --- |
| `/config list <store>` | everything in a store, with its current value |
| `/config get <store> <key>` | one value, in full |
| `/config set <store> <key> <value>` | change a value, or add a new one |
| `/config clear <store> <key>` | empty a value, as though it had never been set |

`/config set` guesses the type of what you type: `16` is stored as a number,
`true` as a boolean, `[1,2]` and `{"a":1}` as JSON, and anything else as text.
Long runs of digits are always kept as text, because discord ids are too big
for a javascript number to hold reliably. Use the `type` option to say
explicitly which you meant.

Changes take effect immediately — the stores are held in memory and the command
updates that copy as well as the database, so there is nothing to restart. That
is only true for changes made *through the command*: editing the database
directly still needs a reboot, because the bot will otherwise overwrite your
edit from memory the next time it writes.

## Status and crash reports

Set `statusThreadId` in the `config` store to a thread id and the bot posts
there every time it starts, saying how the previous run ended — restarted by
somebody, shut down cleanly, or killed without ever getting to tidy up.

```
/config set store:config key:statusThreadId value:<the thread id>
```

If it crashes it posts there too, with the error and the last few hundred lines
of console output attached as a file. Deaths that never reach a handler at all,
like running out of memory, cannot post anything themselves — those are noticed
by the next run instead, and reported when it comes back up.

`/restart` restarts the bot deliberately, and needs the Manage Server
permission. It relies on something outside the bot bringing the process back:
pm2, systemd, docker, whatever is running it.

# Auctions

Anything the bot can hold and hand over can be auctioned. An auction is posted
as an embed with a **Place Bid** button, runs for a few days, and then charges
the winner and pays the seller. Bids are only checked against your balance when
you make them - the winner pays at the end, and if they cannot, it falls to the
next highest bidder.

The bidding, the money, the messages and the timers live in `util/auctions.js`
and are the same for every kind. What is actually being sold is a handler
module per kind, listed in `TYPE_MODULES` at the top of that file:

| Kind | Handler | What is sold |
| --- | --- | --- |
| `lft` | `util/auction-lft.js` | a Lospec Funky Thingy, out of your inventory |
| `role` | `util/auction-role.js` | a discord role, off your account |
| `custom` | `util/auction-custom.js` | whatever a user says it is |

To add another kind, write a module with a default export implementing as much
of the handler contract as it needs - documented above `TYPE_MODULES` - and add
it to that list. Nothing else has to change.

An auction is run from its own post: **Place Bid** is on it, and that is the
whole of it. Once something is up it cannot be called off - it runs its course
and either sells or comes back. There is nothing to list either, because the
auctions are the posts in the thread.

Commands only exist where there is no post to put a button on:

| Command | |
| --- | --- |
| `/auction` | auction something of your own, from your post in the auction forum |
| `/role auction` | put a role you have up for auction |
| `/role give` | hand a role straight to somebody, free |
| `/role list` | the tradeable roles, and who has them |
| `/role tradeable` | admin: say whether a role can be traded at all |
| `/lft auction` | put one of your LFTs up in the marketplace |

## Role auctions

Only roles a moderator has marked tradeable can be bought and sold, and each of
them belongs to one person at a time. Putting one up takes it off you
immediately and gives it to whoever wins; if nobody bids, you get it back.

```
/role tradeable role:@Cool Person tradeable:True
```

The bot needs the Manage Roles permission, and one of its own roles has to sit
above the role in the list, or it cannot hand it out - `/role tradeable` says so
rather than accepting a role it cannot move. Roles discord manages itself, like
the booster role or a bot's own role, can never be traded.

A tradeable role that nobody holds goes up for auction by the treasury at one
pikzel. That covers the role of somebody who leaves the server - which the bot
notices as they go - as well as one that has just been marked tradeable, or one
whose owner left while the bot was down. The last of those is found by a sweep
that runs every half hour, because working out who holds a role means asking
discord for the whole member list.

## User run auctions

Anybody can auction anything they like from a post they started in the auction
forum:

```
/auction title:A commission starting_bid:50
```

The bot only handles the pikzels: it takes the bids, charges the winner and pays
the seller. **Sending whatever was sold is between the two of them** - the bot
says so on the auction and in the thread when it closes. How many auctions one
person may have running at once is `customMaxOpenPerUser`.

## Setting them up

| Store | Key | |
| --- | --- | --- |
| `lft-data` | `marketplaceThreadId` | the thread LFT auctions are posted in |
| `auction-data` | `roleAuctionThreadId` | the thread role auctions are posted in |
| `auction-data` | `customAuctionForumId` | the forum users may auction from, or a list of them |
| `auction-data` | `tradeableRoles` | which roles can be traded - set by `/role tradeable`, not by hand |

Auctions of a kind whose thread has not been set up are simply never posted, so
each kind can be turned on by itself. The rest of `auction-data` - how long
bidding runs for, minimum bids, how many auctions one person may have going,
whether unheld roles are relisted, how often to sweep - is listed with its
defaults at the top of `util/auction-config.js`, and every value can be changed
with `/config set store:auction-data`.

# Dev

How to expand the bot with new functionality.

## Commands

Create a command that users can trigger

Add a file to the `./commands` folder with the following exports:
- `config` - an object containing the JSON configuration for a command
- `execute` - an async function that is called when the function is run (passes interaction as first argument)

### Subcommands

To create a command with subcommands (e.g. `/parent sub`), create a folder inside the `./commands` directory (e.g. `./commands/parent`). Then, create a JavaScript file for each subcommand (e.g. `./commands/parent/sub.js`).

Each subcommand file should have a default export which is an async function that is called when the subcommand is run. This function will receive the interaction object as its first argument.

The parent command (e.g. `parent` in `/parent sub`) should have a `config` export in a file named after the parent command directly in the `./commands` folder (e.g. `./commands/parent.js`). This file does not need an `execute` export if all functionality is handled by subcommands.

## Responses

Respond to a message that matches a filter

Add a file to the `./responses` folder with the following exports:
- `filter` - an async function that checks if the message should trigger a response
- `execute` - an async function that is called when the filter matches

## Autocompletes

Add an autocomplete that provides suggestions for command options.

Add a file to the `./autocompletes` folder with a default export async function that takes the interaction as its first argument. The function should return an array of choices, either as strings or as objects with `{ name, value }` properties. The loader will handle formatting and calling `interaction.respond()` with the results (up to 25 entries).

Autocompletes are loaded automatically from the `autocompletes` folder, similar to commands. You can use the same autocomplete in multiple commands by referencing its name.

To use an autocomplete in a command, set the `autocomplete` property to `true` in the command option config, and make sure there is a corresponding autocomplete where the file name matches the option name.

## Data Storage

To run the bot, you must have set up one of the two data storage options, explained above. Both options have identical APIs.

First you must import the appropriate document from the data module:

`import {CONFIG} from '../data.js';`

Modules that use a lot of properties should be set up with their own data store, which is defined in the data module:

`export const MYDATAMODULENAME = new Data('my-data-module-slug');`

### Methods

- **.get(** `<string>` key **)** - Get the value associated with the provided key
- **.set(** `<string>` key, `<any>` value **)** - Set the value of the provided key to the provided value
- **.keys()** - List the names of every value in the data store
- **.assert(** `<string>` key, `<bool>` required *[optional]* **)** (async) - Ensure a value exists in the data store, and if not, create a blank value and throw an error (unless required is set to false). Must be awaited. This gives the developer a place to enter the value manually. This should only be used in the top level of a file, so commands will not be loaded if the assertion fails.
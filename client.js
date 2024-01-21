import { promises as fs } from 'fs';
await fs.readFile('.env').catch(() => fs.writeFile('.env', ''));
import * as dotenv from 'dotenv';
dotenv.config();
['DISCORD_BOT_TOKEN'].forEach(envVar => {if (!process.env[envVar]) throw new Error(`No ${envVar} provided in your .env file!`);});


import { Client, GatewayIntentBits, Partials } from 'discord.js';
const client = new Client({ 
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});


client.once('ready', async c => {
	console.log('\nLospec Bot v4 is logged in\n');
});


client.login(process.env.DISCORD_BOT_TOKEN);

export default client;
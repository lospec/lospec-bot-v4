
['DISCORD_BOT_TOKEN'].forEach(envVar => {if (!process.env[envVar]) throw new Error(`No ${envVar} provided in your .env file!`);});


import { Client, GatewayIntentBits, Partials } from 'discord.js';
const client = new Client({ 
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});


client.once('ready', async c => {
	console.log('Lospec Bot v4 is logged in');
	client.guilds.cache.forEach(guild => {console.log('Joined server:', guild.name);});
});

client.login(process.env.DISCORD_BOT_TOKEN);

export default client;
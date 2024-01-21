import { REST } from '@discordjs/rest';
import { Routes as DiscordRestRoutes } from 'discord-api-types/v9';
import {glob} from 'glob';
import client from './client.js';
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);

const COMMANDS = {};

client.once('ready', async c => {
	let commandsList = [];
	let commandFileList = glob.sync('./commands/*.js');

	for (let commandPath of commandFileList) {
		let commandName = path.basename(commandPath, '.js');
		let command;
		try { await import('./'+commandPath); }
		catch (err) {
			console.error('Failed to load command:', commandName);
			console.error(err);
			continue;
		}

		if (!command.config) {console.warn('command "'+commandPath+'" has no config export'); continue;}
		if (!command.execute) {console.warn('command "'+commandPath+'" has no execute export'); continue;}
		if (!command.execute.constructor.name == 'AsyncFunction') console.warn('command "'+commandPath+'" execute function is not async');
		commandsList.push(command.config);
		COMMANDS[command.config.name] = command.execute;
		console.log('Loaded command:', '/'+command.config.name);
	}

	if (commandsList.length == 0) return console.warn('No commands found');
	rest.put(DiscordRestRoutes.applicationGuildCommands(client.user.id,process.env.GUILD), {body: commandsList})
		.then(e => console.log('Loaded ',commandsList.length,' commands'))
		.catch(err=> console.error('Failed to load commands:',err))
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
	console.log('/'+ interaction.commandName, 'triggered');

	let command = interaction.commandName;
	let subcommand = interaction.options.getSubcommand(false);
	
	let commandName = command;
	if (subcommand) commandName += '.'+subcommand;
	
	if (!COMMANDS[commandName]) return console.warn('command "'+commandName+'" not found');

	try { 
		console.log('running command "'+commandName+'"');
		await COMMANDS[commandName](interaction); 
	}
	catch (err) {
		console.error('/'+commandName, 'encountered an error:', err);
		if (interaction.deferred || interaction.replied) await interaction.editReply({content: 'Failed to run command: \n\n```'+err+'```', ephemeral: true});
		else await interaction.reply({content: 'Failed to run command: \n\n```'+err+'```', ephemeral: true});
	}
});

export default COMMANDS;
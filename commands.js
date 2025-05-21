import { REST } from '@discordjs/rest';
import { Routes as DiscordRestRoutes } from 'discord-api-types/v9';
import {glob} from 'glob';
import client from './client.js';
import path from 'path';
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);

const COMMANDS = {};

client.once('ready', async c => {
	let commandsList = [];
	let commandFileList = glob.sync('./commands/*.js');
	let subcommandFileList = glob.sync('./commands/*/*.js');

	for (let commandPath of commandFileList) {
		let commandName = path.basename(commandPath, '.js');
		let command;
		try { command = await import('./'+commandPath); }
		catch (err) {
			console.error('Failed to load command:', commandName);
			console.error(err);
			continue;
		}

		if (!command.config) {console.warn('⚠ Command "'+commandPath+'" has no config export'); continue;}
		commandsList.push(command.config);
		COMMANDS[command.config.name] = command.execute || null;
		console.log('Loaded command:', '/'+command.config.name);
	}

	// Load subcommands as COMMANDS[command.subcommand]
	for (let subPath of subcommandFileList) {
		let rel = path.relative('./commands', subPath).replace(/\\/g, '/');
		let [parent, sub] = rel.split('/');
		sub = sub.replace('.js','');
		let subcommand;
		try { subcommand = (await import('./commands/'+parent+'/'+sub+'.js')).default; }
		catch (err) {
			console.error('Failed to load subcommand:', parent+'.'+sub);
			console.error(err);
			continue;
		}
		COMMANDS[parent+'.'+sub] = subcommand;
		console.log('Loaded subcommand:', parent+'.'+sub);
	}

	if (commandsList.length == 0) return console.warn('No commands found');

	client.guilds.cache.forEach(guild => {
		console.log('Joined server:', guild.name);
		rest.put(DiscordRestRoutes.applicationGuildCommands(client.user.id,guild.id), {body: commandsList})
			.then(e => console.log('Added commands to "'+guild.name+'" guild'))
			.catch(err=> console.error('Failed to add commands to "'+guild.name+'" guild'+ err));
	});
});

client.on('interactionCreate', async interaction => {
	if (interaction.isButton()) {
		if (interaction.customId === 'property_confirm_buy') {
			const handler = COMMANDS['property.confirm-buy'];
			if (handler) return handler(interaction);
		}
		if (interaction.customId === 'property_confirm_expand-width') {
			const handler = COMMANDS['property.confirm-expand-width'];
			if (handler) return handler(interaction);
		}
		if (interaction.customId === 'property_confirm_expand-height') {
			const handler = COMMANDS['property.confirm-expand-height'];
			if (handler) return handler(interaction);
		}
		// TODO: Add similar logic for expand-height
	}
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
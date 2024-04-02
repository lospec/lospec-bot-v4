import { ApplicationCommandType, ApplicationCommandOptionType} from 'discord.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { get } from 'http';
import admZip from 'adm-zip';

export const config = {
	name: 'download-all-images-in-thread', 
	description: 'Download every image in the current thread', 
	type: ApplicationCommandType.ChatInput,
};

export const execute = async (interaction) => {
	await interaction.deferReply();
	if (!interaction.channel.isThread()) throw 'This command only works in threads';
	
	let output = 'Downloading all images in thread...\n\n';
	interaction.editReply({ content: output+'fetching messages...', ephemeral: true });

	let foundImages = [];

	let page = 1;
	let lastMessageId = null;
	while (true) {
		let messages = await interaction.channel.messages.fetch({limit: 100, before: lastMessageId});
		if (messages.size == 0) break;
		
		let images = [];

		messages.filter(m => m.attachments.size > 0).forEach(m => {
			//loop through all the attachments in the message
			m.attachments.forEach(a => {
				console.log('attachment',a);
				if (!a.contentType.startsWith('image/')) return;
				images.push(a);
			});
		});

		foundImages.push(...images);
		output += 'Fetched page '+page+' ('+messages.size+' messages), found '+images.length+' images\n';
		interaction.editReply({ content: output, ephemeral: true });
		page++;
		lastMessageId = messages.last().id;
		if (messages.size < 100) break;
	} 

	output += 'Found '+foundImages.length+' images in total\n\n';
	interaction.editReply({ content: output+'downloading images...', ephemeral: true });

	let cacheFolder = './_cache/'+Math.random().toString(36).substring(7);

	try {await fs.access(cacheFolder);} catch (error) {	await fs.mkdir(cacheFolder, {recursive: true});}

	let i = 1;
	// download images
	for (let image of foundImages) {
		let res = await fetch(image.url);
		let buffer = await res.buffer();
		await fs.writeFile (cacheFolder+'/'+image.name, buffer);
		interaction.editReply({ content: output+'downloading images...\n'+i+'/'+foundImages.length, ephemeral: true });
		i++;
	}

	output += 'Downloaded '+foundImages.length+' images\n';
	interaction.editReply({ content: output+'creating zip folder...', ephemeral: true });

	// zip images
	let zip = new admZip();
	zip.addLocalFolder(cacheFolder);
	let zipBuffer = zip.toBuffer();
	await fs.writeFile(cacheFolder+'.zip', zipBuffer);

	output += 'Zip folder created\n';

	// send zip
	interaction.editReply({ 
		content: output, 
		ephemeral: true,
		files: [cacheFolder+'.zip']
	});

	console.log('Downloading images:', foundImages);
}

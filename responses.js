import { REST } from '@discordjs/rest';
import {glob} from 'glob';
import client from './client.js';
import path from 'path';
const RESPONSES = {};

client.once('ready', async c => {
	let responsesList = [];
	let responseFileList = glob.sync('./commands/*.js');

	for (let responsePath of responseFileList) {
		let response = await import('./'+responsePath);
		let responseName = path.basename(responsePath, '.js');
		if (!response.filter) {console.warn('response "'+responsePath+'" has no filter export'); continue;}
		if (!response.execute) {console.warn('response "'+responsePath+'" has no execute export'); continue;}
		if (!response.execute.constructor instanceof AsyncFunction) console.warn('response "'+responsePath+'" execute function is not async');
		responsesList.push(response.config);
		RESPONSES[responseName] = response.execute;
		console.log('Loaded response:', responseName);
	}
});

client.on('messageCreate', async interaction => {
	
	//loop through responses and check if any filter
	for (let responseName in RESPONSES) {
		if (RESPONSES[responseName].filter(interaction)) {
			console.log('running response "'+responseName+'"');
			try {
				await RESPONSES[responseName](interaction); 
			}
			catch (err) {
				console.error(responseName, 'encountered an error:', err);
			}
		}
	}
});

export default RESPONSES;
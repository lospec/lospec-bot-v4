// Shared bits for the /config command - reading, writing and displaying
// values in the data stores without anybody having to open the database.

import { PermissionFlagsBits } from 'discord.js';
import { STORES } from '../data.js';

export const STORE_SLUGS = Object.keys(STORES);

export const TYPE_CHOICES = ['auto', 'string', 'number', 'boolean', 'json'];


export function getStore (slug) {
	const store = STORES[slug];
	if (!store) throw new Error('There is no data store called `' + slug + '`.');
	return store;
}


// Slash command permissions can be overridden per server, so being in the
// admin-only command list is not enough on its own.
export function requireAdmin (interaction) {
	if (!interaction.inGuild())
		throw new Error('This command only works in a server.');

	if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
		throw new Error('Only administrators can read or change bot configuration.');
}


// Works out what type the admin meant. Discord ids are longer than a js number
// can hold exactly, so anything that does not survive the round trip is left
// as the string it needs to be.
export function parseValue (input, type = 'auto') {
	const text = String(input).trim();

	if (type === 'string') return text;

	//discord ids are 17-19 digits. some of them survive being turned into a
	//number and some do not, so none of them are - and no real setting is a
	//number that long anyway
	if (type === 'auto' && /^\d{15,}$/.test(text)) return text;

	if (type === 'number' || (type === 'auto' && /^-?\d+(\.\d+)?$/.test(text))) {
		const number = Number(text);
		if (!Number.isFinite(number)) throw new Error('`' + text + '` is not a number.');
		if (String(number) !== text) {
			if (type === 'number') throw new Error('`' + text + '` is too big to store as a number without losing digits. Store it as a string instead.');
			return text;
		}
		return number;
	}

	if (type === 'boolean' || (type === 'auto' && (text === 'true' || text === 'false'))) {
		if (text !== 'true' && text !== 'false') throw new Error('`' + text + '` is not true or false.');
		return text === 'true';
	}

	if (type === 'json' || (type === 'auto' && (text.startsWith('[') || text.startsWith('{')))) {
		try {return JSON.parse(text);}
		catch (err) {throw new Error('That could not be read as JSON. ' + err.message);}
	}

	if (type === 'auto' && text === 'null') return null;

	return text;
}


export function describeType (value) {
	if (value === undefined) return 'unset';
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array of ' + value.length;
	return typeof value;
}


export function formatValue (value, limit = 900) {
	if (value === undefined) return '*not set*';
	if (value === null) return '`null`';
	if (value === '') return '*empty*';

	if (typeof value === 'string') return '`' + truncate(value, limit) + '`';
	if (typeof value !== 'object') return '`' + value + '`';

	return '```json\n' + truncate(JSON.stringify(value, null, 1), limit - 12) + '\n```';
}


export function truncate (text, limit) {
	text = String(text);
	if (text.length <= limit) return text;
	return text.slice(0, limit - 3) + '...';
}

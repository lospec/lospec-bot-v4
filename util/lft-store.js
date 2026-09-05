// Storage for LFTs, user inventories and auctions.
//
// The Data class in data.js is a key/value document per module, which is fine
// for a handful of settings but not for thousands of LFTs and inventory rows.
// This store keeps the documents in memory and writes each change through to
// mongodb (or to a json file when LOCAL_DATA_STORAGE is used), so it supports
// both storage options the same way the rest of the bot does.

import fsp from 'fs/promises';
import path from 'path';

const LOCAL_PATH = path.join('_data', 'lft-store.json');

//how a document in each collection is uniquely identified
const KEY_OF = {
	lfts: doc => 'lft-' + doc.number,
	inventory: doc => doc.userId + '-' + doc.lftNumber,
	auctions: doc => doc.id,
};

const memory = {lfts: [], inventory: [], auctions: []};

let backend;

if (process.env.MONGO_URI) backend = await createDatabaseBackend();
else if (process.env.LOCAL_DATA_STORAGE) backend = await createLocalBackend();
else throw new Error('Data storage not configured, please see the "Data Storage" section under README.md');

console.log('Loaded LFT store:', memory.lfts.length, 'lfts,', memory.inventory.length, 'inventory rows,', memory.auctions.length, 'auctions');


async function createDatabaseBackend () {
	const {database} = await import('../data-database.js');

	const collections = {};
	for (const name of Object.keys(memory)) {
		collections[name] = database.collection('lft-' + name);
		memory[name] = (await collections[name].find({}).toArray()).map(stripId);
	}

	await collections.lfts.createIndex({hash: 1});
	await collections.lfts.createIndex({name: 1});
	await collections.auctions.createIndex({status: 1});

	return {
		async save (name, doc) {
			const _id = KEY_OF[name](doc);
			await collections[name].replaceOne({_id}, {...doc, _id}, {upsert: true});
		},
		async remove (name, doc) {
			await collections[name].deleteOne({_id: KEY_OF[name](doc)});
		}
	};
}


async function createLocalBackend () {
	//recursive, because the key/value store is creating this same folder at
	//the same time and a plain mkdir would lose the race
	await fsp.mkdir('./_data', {recursive: true});

	try {
		const loaded = JSON.parse(await fsp.readFile(LOCAL_PATH, 'utf-8'));
		for (const name of Object.keys(memory))
			if (Array.isArray(loaded[name])) memory[name] = loaded[name];
	}
	catch (err) {
		if (err.code !== 'ENOENT') console.error('Failed to read LFT store, starting empty', err);
	}

	//the whole file gets rewritten every time, so writes are batched together
	//and then queued, rather than several of them landing on the file at once
	let queued = null;
	let writing = Promise.resolve();

	const write = () => {
		if (queued) return queued;

		queued = new Promise(resolve => setTimeout(resolve, 50)).then(() => {
			queued = null;
			writing = writing.then(() => fsp.writeFile(LOCAL_PATH, JSON.stringify(memory, null, '\t')));
			return writing;
		});

		return queued;
	};

	return {save: write, remove: write};
}


function stripId (doc) {
	const {_id, ...rest} = doc;
	return rest;
}


//insert or update a document, and persist it
async function put (name, doc) {
	const key = KEY_OF[name](doc);
	const existing = memory[name].find(d => KEY_OF[name](d) === key);
	if (existing) Object.assign(existing, doc);
	else memory[name].push(doc);
	await backend.save(name, existing || doc);
	return existing || doc;
}

async function drop (name, doc) {
	const key = KEY_OF[name](doc);
	const index = memory[name].findIndex(d => KEY_OF[name](d) === key);
	if (index !== -1) memory[name].splice(index, 1);
	await backend.remove(name, doc);
}


// ---------------------------------------------------------------- lfts

export function getAllLfts () {
	return memory.lfts;
}

export function getLftCount () {
	return memory.lfts.length;
}

export function getLftByNumber (number) {
	return memory.lfts.find(lft => lft.number === Number(number));
}

export function getLftByName (name) {
	return memory.lfts.find(lft => lft.name === String(name).toLowerCase());
}

export function getLftByHash (hash) {
	return memory.lfts.find(lft => lft.hash === hash);
}

export function getNextLftNumber () {
	return memory.lfts.reduce((highest, lft) => Math.max(highest, lft.number), 0) + 1;
}

export async function saveLft (lft) {
	return put('lfts', lft);
}


// ----------------------------------------------------------- inventory

export function getInventory (userId) {
	return memory.inventory.filter(row => row.userId === userId && row.quantity > 0);
}

export function getInventoryRow (userId, lftNumber) {
	return memory.inventory.find(row => row.userId === userId && row.lftNumber === Number(lftNumber));
}

export function getOwners (lftNumber) {
	return memory.inventory.filter(row => row.lftNumber === Number(lftNumber) && row.quantity > 0);
}

export async function addToInventory (userId, lftNumber, quantity = 1) {
	const row = getInventoryRow(userId, lftNumber) || {userId, lftNumber: Number(lftNumber), quantity: 0};
	row.quantity += quantity;
	row.updatedAt = new Date().toISOString();
	return put('inventory', row);
}

//removes copies from a user, throwing rather than ever going negative
export async function removeFromInventory (userId, lftNumber, quantity = 1) {
	const row = getInventoryRow(userId, lftNumber);
	if (!row || row.quantity < quantity) throw new Error('You do not own that LFT.');

	row.quantity -= quantity;
	row.updatedAt = new Date().toISOString();

	if (row.quantity <= 0) await drop('inventory', row);
	else await put('inventory', row);
}


// ------------------------------------------------------------ auctions

export function getAllAuctions () {
	return memory.auctions;
}

export function getAuction (id) {
	return memory.auctions.find(auction => auction.id === id);
}

export function getOpenAuctions () {
	return memory.auctions.filter(auction => auction.status === 'open');
}

export function getOpenAuctionForLft (lftNumber) {
	return memory.auctions.find(auction => auction.status === 'open' && auction.lftNumber === Number(lftNumber));
}

export async function saveAuction (auction) {
	return put('auctions', auction);
}

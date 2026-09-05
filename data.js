var Data;

if (process.env.MONGO_URI ) Data = (await import('./data-database.js')).default;
else if (process.env.LOCAL_DATA_STORAGE) Data = (await import('./data-local.js')).default;
else throw new Error('Data storage not configured, please see the "Data Storage" section under README.md');

export const CONFIG = new Data('config');
export const YON_DATA = new Data('yon');
export const YON_CONFIG = new Data('yon-config');
export const EMOJI_DATA = new Data('emoji-data');
export const DEXELAR_DATA = new Data('dexelar-data');
export const LFT_DATA = new Data('lft-data');
export var Data;

//every store, by slug - used by /config to list and edit them from discord
export const STORES = {
	'config': CONFIG,
	'yon': YON_DATA,
	'yon-config': YON_CONFIG,
	'emoji-data': EMOJI_DATA,
	'dexelar-data': DEXELAR_DATA,
	'lft-data': LFT_DATA,
};

export default true;
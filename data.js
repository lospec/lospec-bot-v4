
var Data;

if (process.env.MONGO_URI ) Data = (await import('./data-database.js')).default;
else if (process.env.LOCAL_DATA_STORAGE) Data = (await import('./data-local.js')).default;
else throw new Error('Data storage not configured, please see the "Data Storage" section under README.md');

export const CONFIG = new Data('config');
export var Data;
export default true;
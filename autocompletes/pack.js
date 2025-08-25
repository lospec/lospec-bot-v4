import { DEXELAR_DATA } from '../data.js';

export default async function(){
    const packs = DEXELAR_DATA.get('packs') || {};
    return Object.keys(packs).map(name => ({ name, value: name })).slice(0,25);
}

import Datastore from 'data-store';
import { promises as fs } from 'fs';

try {await fs.access('./_data');}
catch (err) {await fs.mkdir('./_data');}

console.log('Using local data storage...');

class Data {
	constructor(slug) {
		if (!slug.match(/^[a-z-]+$/)) throw new Error('Invalid slug: "'+slug+'"');
		this.slug = slug;
		this.store = new Datastore({ path: '_data/'+slug+'.json' });
		this.store.save();
	}

	get(key) {
		return this.store.get(key);
	}

	set(key, value) {
		return this.store.set(key, value);
	}

	assert(key, required = true) {
		let value = this.get(key);
		if (!value || value == '') this.set(key, '');
		else return true;
		
		if (required) throw new Error('Key "'+key+'" not defined in data store "'+this.slug+'"');
	}
}

export default Data;
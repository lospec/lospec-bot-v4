import Datastore from 'data-store';
import { promises as fs } from 'fs';

await fs.mkdir('./_data', {recursive: true});

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

	keys() {
		return Object.keys(this.store.data || {});
	}

	assert(...args) {
		const required = typeof args[args.length - 1] === 'boolean' ? args.pop() : true;
		const keys = args;

		for (const key of keys) {
			let value = this.get(key);
			if (!value || value == '') {
				this.set(key, '');
				if (required) throw new Error('Key "'+key+'" not defined in data store "'+this.slug+'"');
			}
		}
		return true;
	}
}

export default Data;
import { MongoClient, ObjectId } from 'mongodb';
const client = new MongoClient(process.env.MONGO_URI);
await client.connect();

let db = client.db(process.env.DATABASE_NAME || 'LospecBotV4');

//check if the collection exists and create it if not
let collections = await db.listCollections().toArray();
if (!collections.find(c => c.name == 'data')) await db.createCollection('data');
let collection = db.collection('data');

console.log('Using MongoDB data storage...');

class Data {
	constructor(slug) {
		if (!slug.match(/^[a-z-]+$/)) throw new Error('Invalid slug: "'+slug+'"');
		this.slug = slug;
		this.initialize();
	}

	async initialize() {
		console.log('Initializing data store:', this.slug);
		//make sure the document exists and create it if not
		try {
			this.store = await collection.findOne({name: this.slug});
			if (!this.store) await collection.insertOne({name: this.slug});
		}
		catch (err) {console.error(err);}
	}

	get(key) {
		return this.store[key];
	}

	set(key, value) {
		this.store[key] = value;
	}

	async assert(key, required = true) {
		await this.initialize();
		
		if (!this.store[key] || this.store[key] == '') {
			this.store[key] = '';
			await collection.updateOne({_id: this.store._id}, {$set: {[key]: ''}});
			if (required) throw new Error('Key "'+key+'" is not defined in data store "'+this.slug+'"');
		}
	}
}

export default Data;
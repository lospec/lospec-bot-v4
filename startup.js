import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
console.log('█'.repeat(80), '\n\nLospec Bot v4 is starting up...');
console.log('Loading dotenv file...');
dotenv.config();

if (process.env.MONGO_CERT_FILE) {
	try {await fs.access('./ca-certificate.crt');}
	catch (err) {
		console.log('Writing MongoDB certificate to file...');
		try {
			await fs.writeFile('./ca-certificate.crt', process.env.MONGO_CERT_FILE);
			console.log('Certificate written to file!');
		} catch (err) {console.error(err);}
	}
}

export default true;
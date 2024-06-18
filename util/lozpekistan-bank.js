import fetch from 'node-fetch';

const API_REQUEST_OPTIONS = {headers: {Authorization: process.env.LOZPEKISTAN_BANK_API_KEY}};
const API_URL = 'http://'+process.env.LOZPEKISTAN_BANK_API_ADDRESS;

export async function checkIfUserCanAfford (userId, price) {
	let balance;

	try {
		const response = await fetch(API_URL+'/balance/'+userId, API_REQUEST_OPTIONS);
		const data = await response.json();
		console.log('got user balance:',data);
		balance = data;
	}
	catch (err) {
		console.error('Failed to check user balance',err);
		throw new Error('Failed to check user balance');
	}

	if (balance > price) return;
	throw new Error('You do not have enough P to purchase this emoji. You need '+price+'P, but you only have '+balance+'P.');
}

export async function takeUsersMoney (userId, price) {
	try {
		const response = await fetch(API_URL+'/balance/'+userId, API_REQUEST_OPTIONS);
		const data = await response.json();
		console.log('got user balance:',data);
		let balance = data;
		if (balance < price) 
			throw new Error('You do not have enough P to purchase this emoji. You need '+price+'P, but you only have '+balance+'P.');


		//post request to /balance/userId with body {amount:price}
		const response2 = await fetch(API_URL+'/balance/'+userId, { 
			method: 'POST',
			headers: {
				...API_REQUEST_OPTIONS.headers, 
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({amount: -price})
		});
		if (!response2.ok) 
			throw new Error('Money taking request failed: '+response2.status, response2.statusText);
		const data2 = await response2.json();

		console.log('withdrew money:',data2);
	}
	catch (err) {
		console.error('Failed to withdraw money',err);
		throw new Error('Failed to withdraw money');
	}
}
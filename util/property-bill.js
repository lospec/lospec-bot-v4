import { PROPERTY_STYLES } from './property-styles.js';

class PropertyBill {
	constructor(service, total, billLines) {
		this.service = service;
		this.total = total;
		this.billLines = billLines;
	}

	get invoice() {
		return this.generateBillText();
	}
	
	generateBillText() {
		return [
			'```',
			'HOME '+ this.service.toUpperCase() +' INVOICE',
			'--------------------------',
			...this.billLines.map(l => l.toUpperCase()),
			'--------------------------',
			`TOTAL: $${this.total}`,
			'```'
		].join('\n');
	}
}

export function getExpandWidthBill(userProperty) {
	const width = userProperty.width || 1;
	const height = userProperty.height || 1;
	const style = userProperty.style || 'Cabin';
	const styleObj = PROPERTY_STYLES.find(s => s.name.toLowerCase() === style.toLowerCase()) || PROPERTY_STYLES[0];
	let tileTotal = 0;
	let billLines = [];
	for (let floor = 1; floor <= height; floor++) {
		tileTotal += (floor);
		billLines.push(`FLOOR ${floor} BLOCK x 1 = $${floor}`);
	}
	const base = 1.3;
	const landFee = Math.round(Math.pow(base, width + 1));
	billLines.push(`LAND FEE FOR WIDTH ${width + 1} = $${landFee}`);
	const materialsFee = styleObj.cost * height;
	billLines.push(`MATERIALS (${styleObj.name}) x ${height} = $${materialsFee}`);
	const total = tileTotal + landFee + materialsFee;

	return new PropertyBill('expansion', total, billLines);
}


export function getExpandHeightBill(userProperty) {
	const width = userProperty.width || 1;
	const height = userProperty.height || 1;
	const style = userProperty.style || 'Cabin';
	const styleObj = PROPERTY_STYLES.find(s => s.name.toLowerCase() === style.toLowerCase()) || PROPERTY_STYLES[0];
	const floorCost = height + 1;
	const total = width * floorCost;
	const materialsFee = styleObj.cost * width;
	const billLines = [`FLOOR ${floorCost} BLOCK X ${width} = $${total}`];
	billLines.push(`MATERIALS (${styleObj.name}) x ${width} = $${materialsFee}`);
	const grandTotal = total + materialsFee;

	return new PropertyBill('expansion', grandTotal, billLines);
}


export function getChangeStyleBill(userProperty, newStyle) {
	const width = userProperty.width || 1;
	const height = userProperty.height || 1;
	const tileCount = width * height;
	const styleCost = newStyle.cost * tileCount;
	const laborCost = tileCount;
	const billLines = [
		`MATERIALS (${newStyle.name}) x ${tileCount} tiles = $${styleCost}`,
		`RENOVATION LABOR x ${tileCount} tiles = $${laborCost}`,
	];
	const total = styleCost + laborCost;

	return new PropertyBill('renovation', total, billLines);
}


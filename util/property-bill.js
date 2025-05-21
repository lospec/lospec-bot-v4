export function getExpandWidthBill(userProperty) {
	const width = userProperty.width || 1;
	const height = userProperty.height || 1;
	let tileTotal = 0;
	let billLines = [];
	for (let floor = 1; floor <= height; floor++) {
		tileTotal += (floor);
		billLines.push(`FLOOR ${floor} BLOCK x 1 = $${floor}`);
	}
	const base = 1.3;
	const landFee = Math.round(Math.pow(base, width + 1));
	billLines.push(`LAND FEE FOR WIDTH ${width + 1} = $${landFee}`);
	return { total: tileTotal + landFee, billLines, tileTotal, landFee };
}


export function getExpandHeightBill(userProperty) {
	const width = userProperty.width || 1;
	const height = userProperty.height || 1;
	const floorCost = height + 1;
	const total = width * floorCost;
	const billLine = `FLOOR ${floorCost} BLOCK X ${width} = $${total}`;
	return {
		total,
		billLines: [billLine]
	};
}
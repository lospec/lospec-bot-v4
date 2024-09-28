
const wordReplacements = {
	'ALLOW': 'SUFFER',
	'ARE': 'ART',
	'ATTACK': 'ENGAGE',
	'BULLSHIT': 'MARLARKY',
	'COME': 'COMETH',
	'COMES': 'COMETH',
	'CANT': 'CANNOTST',
	'CAN\'T': 'CANNOTST',
	'CANNOT': 'CANNOTST',
	'COULD': 'COULDETH',
	'DID': 'DIDST',
	'DEW': 'DEAU',
	'DO': 'DOTH',
	'DOES': 'DOTH',
	'EAST': 'EASTWARD',
	'FAIR': 'JUDICIOUS',
	'FART': 'FLATULATE',
	'FARTED': 'FLATULATED',
	'FARTS': 'FLATULATES',
	'FIND': 'FINDETH',
	'GRAB': 'GRASP',
	'GRABBED': 'GRASPED',
	'GRABS': 'GRASPS',
	'GRABBING': 'GRASPING',
	'HATE': 'ABHOR',
	'HAVE': 'HATH',
	'HELP': 'HELPETH',
	'HERE': 'HITHER',
	'HEY': 'HARK',
	'HI': 'HAIL',
	'ITS': 'TIS',
	'IT\'S': 'TIS',
	'JAM': 'JAMMETH',
	'JUDGE': 'MAGISTRATE',
	'LISTEN': 'HEARKEN',
	'NO': 'NAY',
	'NOT': 'NAY',
	'NORTH': 'NORTHWARD',
	'NEED': 'NEEDETH',
	'OF': 'O\'',
	'OK': 'VERILY',
	'OLD': 'OLDE',
	'POOPED': 'BESMIRCHED',
	'SAY': 'SAYETH',
	'SAYS': 'SAYETH',
	'SOUTH': 'SOUTHWARD',
	'STUFF': 'STUFFETH',
	'THAT': 'YON',
	'THIS': 'YON',
	'THE': 'YE',
	'THOSE': 'YON',
	'TIED': 'TIEDST',
	'TOILET': 'CHAMBERPOT',
	'UNDERWEAR': 'LOINCLOTH',
	'WALK': 'WALKETH',
	'WANT': 'WANTETH',
	'WEST': 'WESTWARD',
	'WHERE': 'FROM WHENCE',
	'WHY': 'WHEREFORE',
	'WILL': 'WILT',
	'YOU': 'YE',
	'YOUR': 'THY',
	'YOU\'RE': 'YE ART',
	'YOURSELF': 'YESELF',
}


const replaceWorlds = (text) => {
	let words = text.split(' ');
	let yonified = words.map(word => {
		let replacement = wordReplacements[word.toUpperCase()];
		if (replacement) return replacement;
		return word;
	});
	return yonified.join(' ');
}

function convertText(text) {
	text = text.toUpperCase();
	text = replaceWorlds(text);
	return text;
}

export default convertText;
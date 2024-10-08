
const wordReplacements = {
	'ABOUT': 'CONCERNING',
	'ABOVE': 'UPON',
	'AFRAID': 'FEARFUL',
	'AGAIN': 'ONCE MORE',
	'ALLOW': 'SUFFER',
	'ARE': 'ART',
	'ASS': 'POSTERIOR',
	'ATTACK': 'ENGAGE',
	'ATTEMPT': 'ATTEMPTETH',
	'ATTEMPTS': 'ATTEMPTETH',
	'BAD': 'WRETCHED',
	'BEER': 'ALE',
	'BEFORE': 'ERE',
	'BEGIN': 'COMMENCE',
	'BROTHER': 'BRETHREN',
	'BULLSHIT': 'MARLARKY',
	'BUTT': 'POSTERIOR',
	'CLIMB': 'CLIMBETH',
	'COME': 'COMETH',
	'COMES': 'COMETH',
	'CANT': 'CANNOTST',
	'CAN\'T': 'CANNOTST',
	'CANNOT': 'CANNOTST',
	'CAR': 'CARRIAGE',
	'CHEST': 'COFFER',
	'COME': 'COMMETH',
	'COMPUTER': 'ABACUS',
	'COULD': 'COULDETH',
	'CRAP': 'DUNG',
	'DAMN': 'CURSE',
	'DAMNED': 'CURSED',
	'DAMNIT': 'I CURSE THEE',
	'DANCE': 'JIG',
	'DANCING': 'JIGGING',
	'DANCED': 'JIGGED',
	'DID': 'DIDST',
	'DIE': 'PERISH',
	'DEAD': 'DECEASED',
	'DEW': 'DEAU',
	'DO': 'DOTH',
	'DOES': 'DOTH',
	'EAST': 'EASTWARD',
	'FAIR': 'JUDICIOUS',
	'FART': 'FLATULATE',
	'FARTED': 'FLATULATED',
	'FARTS': 'FLATULATES',
	'FARTING': 'FLATULATING',
	'FAST': 'SWIFT',
	'FASTER': 'MORE SWIFT',
	'FASTEST': 'MOST SWIFT',
	'FAT': 'STOUT',
	'FATTER': 'MORE STOUT',
	'FATTEST': 'MOST STOUT',
	'FIND': 'FINDETH',
	'FLIMSY': 'FRAIL',
	'FRIEND': 'COMRADE',
	'FRIENDS': 'COMRADES',
	'FUCK': 'COITUS',
	'GIRL': 'LASS',
	'GIRLS': 'LASSES',
	'GRAB': 'GRASP',
	'GRABBED': 'GRASPED',
	'GRABS': 'GRASPS',
	'GRABBING': 'GRASPING',
	'GUY': 'CHAP',
	'GUYS': 'CHAPS',
	'HAPPY': 'MERRY',
	'HATE': 'ABHOR',
	'HAVE': 'HATH',
	'HELP': 'HELPETH',
	'HERE': 'HITHER',
	'HEY': 'HARK',
	'HI': 'HAIL',
	'IMAGE': 'LIKENESS',
	'IMAGINARY': 'FANTASTICAL',
	'ITS': 'TIS',
	'JAM': 'JAMMETH',
	'JUDGE': 'MAGISTRATE',
	'KILL': 'SLAY',
	'KILLING': 'SLAYING',
	'KILLED': 'SLAIN\'',
	'LIE': 'FALSEHOOD',
	'LISTEN': 'HEARKEN',
	'LOUD': 'CLAMOROUS',
	'MINUTE': 'MOMENT',
	'MINUTES': 'MOMENTS',
	'MY': 'MINE OWN',
	'NO': 'NAY',
	'NOT': 'NAY',
	'NORTH': 'NORTHWARD',
	'NEED': 'NEEDETH',
	'NEVER': 'NE\'ER',
	'OF': 'O\'',
	'OK': 'VERILY',
	'OLD': 'OLDE',
	'ON': 'UPON',
	'PANTS': 'BREECHES',
	'PHOTO': 'PAINTING',
	'PHOTOS': 'PAINTINGS',
	'PICTURE': 'PAINTING',
	'PICTURES': 'PAINTINGS',
	'POOPED': 'BESMIRCHED',
	'POWER': 'MIGHT',
	'PROSTITUTE': 'HARLOT',
	'PROSTITUTES': 'HARLOTS',
	'ROCK': 'STONE',
	'ROOM': 'CHAMBER',
	'SAD': 'SORROWFUL',
	'SAID': 'QUOTH',
	'SAY': 'SAYETH',
	'SAYS': 'SAYETH',
	'SCIENCE': 'WITCHCRAFT',
	'SCIENTIST': 'WITCH',
	'SCIENTISTS': 'WITCHES',
	'SHIT': 'DUNG',
	'SKILL': 'ART',
	'SLUT': 'HARLOT',
	'SLUT': 'SLUTS',
	'SOUTH': 'SOUTHWARD',
	'SPILL': 'SPILLETH',
	'STUFF': 'STUFFETH',
	'TECHNOLOGY': 'WITCHCRAFT',
	'THAT': 'YON',
	'THIS': 'YON',
	'THE': 'YE',
	'THOSE': 'YON',
	'TIE': 'BINDETH',
	'TIED': 'BINDST',
	'TIRED': 'WEARY',
	'TOILET': 'CHAMBERPOT',
	'UNDERWEAR': 'LOINCLOTH',
	'WALK': 'WALKETH',
	'WANT': 'WANTETH',
	'WEAK': 'FEEBLE',
	'WIERD': 'PECULIAR',
	'WEST': 'WESTWARD',
	'WET': 'DAMP',
	'WHERE': 'FROM WHENCE',
	'WHORE': 'HARLOT',
	'WHORES': 'HARLOTS',
	'WHY': 'WHEREFORE',
	'WILL': 'SHALT',
	'WITHOUT': 'SANS',
	'YOU': 'THOU',
	'YOUR': 'THY',
	'YOURE': 'YE ART',
	'YOURSELF': 'YESELF',
}





const replaceWorlds = (text) => {
	let words = text.match(/\b[\w']+\b|[.,!?;:]/g);
	let yonified = words.map(word => {
		let targetMatch = word.toUpperCase().replace(/[^A-Z]/g, '');

		if (wordReplacements[targetMatch]) 
			return wordReplacements[targetMatch];
		else 
			return word;
	});
	return yonified.join(' ').replace(/\s([.,!?;:])/g, '$1');
}

function convertText(text) {
	text = text.toUpperCase();
	text = replaceWorlds(text);
	return text;
}

export default convertText;
// Works out how somebody is talking to the bot, so it can react with the
// right face. Pure text in, a category name out - nothing here touches
// discord, so it can be run from the command line to check a phrase.
//
// A message is scored against word lists for each category. Words a few
// places after a negation ("not funny", "isn't good") count for the
// opposite: a negated compliment is an insult, and a negated insult
// ("not bad") is a compliment. The category with the most hits wins; on a
// tie, whichever was mentioned last, since people tend to end on the point.

export const CATEGORIES = ['pizza', 'smart', 'sexy', 'funny', 'positive', 'negative'];

//when two categories score the same, the more specific one is listed first
//here and wins if the last-mentioned rule cannot separate them either
const SPECIFICITY = ['pizza', 'smart', 'sexy', 'funny', 'positive', 'negative'];

//a negated one of these becomes this instead
const OPPOSITE = {
	pizza: 'negative',
	smart: 'negative',
	sexy: 'negative',
	funny: 'negative',
	positive: 'negative',
	negative: 'positive',
};


// --------------------------------------------------------------- words

//multi-word entries are matched as a run of tokens. everything is passed
//through normalize() so apostrophes and case do not matter when writing them
const WORDS = {
	pizza: [
		'pizza', 'pizzas', 'pizzer', 'pizzi', 'pizz', 'za', 'pepperoni', 'margherita', 'calzone',
		'deep dish', 'dominos', 'papa johns', 'pizza hut', 'little caesars', 'pineapple on pizza',
		'pineappleonpizza', 'stuffed crust', 'thin crust', 'pizzeria',
	],

	smart: [
		'smart', 'smartest', 'smarty', 'intelligent', 'intelligence', 'clever', 'genius', 'wise', 'wisdom',
		'brainy', 'brain', 'big brain', 'bigbrain', 'galaxy brain', 'einstein', 'sherlock', 'nerd', 'nerdy',
		'scholar', 'professor', 'phd', 'iq', 'high iq', '200 iq', 'know it all', 'knows everything',
		'knowledgeable', 'thinker', 'think', 'thinking', 'thoughtful', 'philosopher', 'sage', 'guru',
		'enlightened', 'logical', 'logic', 'mathematician', 'encyclopedia', 'oracle', 'sentient', 'sapient',
		'self aware', 'agi', 'skynet', 'overlord', 'insightful', 'perceptive', 'sharp', 'quick witted',
		'well read', 'educated', 'learned', 'galaxybrain', 'calculated', 'strategic', 'mastermind',
	],

	sexy: [
		'sexy', 'sexc', 'sexii', 'hot', 'hottie', 'hawt', 'beautiful', 'handsome', 'gorgeous', 'pretty', 'stunning',
		'attractive', 'rizz', 'rizzler', 'rizzy', 'smash', 'marry me', 'marry', 'date me', 'husband', 'wife',
		'boyfriend', 'girlfriend', 'crush', 'daddy', 'mommy', 'babe', 'bae', 'hunk', 'thicc', 'thick', 'dreamy',
		'seductive', 'sultry', 'flirt', 'flirty', 'flirting', 'kissable', 'hubba hubba', 'awooga', 'zaddy',
		'stud', 'snack', 'smokin', 'smoking hot', 'foxy', 'sexiest', 'hottest', 'dashing', 'ravishing',
		'dilf', 'milf', 'thirst', 'thirsty', 'horny', 'simp', 'simping', 'wink', 'smirk', 'kiss me',
		'kiss', 'kisses', 'smooch', 'xoxo', 'mwah', 'muah', 'sexual', 'seggs', 'step on me', 'call me',
		'good looking', 'goodlooking', 'looking good', 'lookin good', 'lookin fine', 'looking fine', 'fine af',
	],

	funny: [
		'funny', 'funniest', 'hilarious', 'lol', 'lols', 'lolol', 'lololol', 'lmao', 'lmaoo', 'lmaooo', 'lmfao',
		'rofl', 'roflmao', 'haha', 'hahaha', 'hahahaha', 'hah', 'hahah', 'bahaha', 'mwahaha', 'hehe', 'hehehe',
		'heh', 'lel', 'kek', 'top kek', 'xd', 'jaja', 'jajaja', 'jsjs', 'joke', 'jokes', 'joking', 'joker',
		'comedian', 'comedy', 'comedy gold', 'laugh', 'laughing', 'laughed', 'humor', 'humour', 'humorous',
		'witty', 'goofy', 'silly', 'meme', 'memes', 'memey', 'im dead', 'dying', 'im dying', 'wheeze',
		'wheezing', 'cackling', 'snort', 'chuckle', 'giggle', 'giggling', 'pfft', 'pft', 'good one',
		'banter', 'troll', 'trolling', 'whosgonnatellbro', 'clueless', 'ha', 'lmbo', 'lulz', 'lmao no',
		'im crying', 'crying laughing', 'that got me', 'got me', 'im wheezing', 'im screaming', 'screaming',
		'hysterical', 'hysterics', 'amusing', 'amused', 'clown', 'clownin', 'ridiculous', 'absurd',
	],

	positive: [
		'thanks', 'thank', 'thank you', 'thankyou', 'thank u', 'thx', 'thnx', 'ty', 'tysm', 'tyvm', 'thanks a lot',
		'thanks bot', 'ty bot', 'cheers', 'appreciate', 'appreciated', 'appreciate it', 'good', 'great',
		'nice', 'cool', 'awesome', 'amazing', 'wonderful', 'fantastic', 'excellent', 'perfect', 'brilliant',
		'superb', 'splendid', 'lovely', 'sweet', 'neat', 'rad', 'dope', 'lit', 'fire', 'sick', 'epic', 'legend',
		'legendary', 'goat', 'goated', 'king', 'queen', 'hero', 'best', 'better', 'well done', 'good job',
		'good bot', 'best bot', 'nice bot', 'cool bot', 'nice one', 'love', 'loved', 'love it', 'love you',
		'love u', 'ily', 'ilysm', 'adore', 'like', 'liked', 'like it', 'cute', 'cutie', 'adorable', 'precious',
		'sweetheart', 'sweetie', 'wholesome', 'based', 'w', 'dub', 'win', 'winner', 'yay', 'yeah', 'yep', 'yup',
		'yes', 'wow', 'woah', 'whoa', 'poggers', 'pog', 'pogchamp', 'pogu', 'chill', 'happy', 'glad', 'joy',
		'fun', 'enjoy', 'enjoyed', 'helpful', 'helped', 'useful', 'right', 'correct', 'agree', 'agreed', 'true',
		'exactly', 'indeed', 'absolutely', 'definitely', 'bless', 'blessed', 'proud', 'proud of you', 'congrats',
		'congratulations', 'gg', 'kudos', 'props', 'respect', 'bravo', 'slay', 'iconic', 'valid', 'real', 'mvp',
		'hug', 'hugs', 'friend', 'friends', 'bestie', 'buddy', 'pal', 'good boy', 'good girl', 'impressive',
		'incredible', 'outstanding', 'phenomenal', 'marvelous', 'marvellous', 'delightful', 'charming',
		'pleasant', 'fabulous', 'glorious', 'magnificent', 'stellar', 'top tier', 's tier', 'peak', 'banger',
		'bangers', 'vibe', 'vibes', 'mood', 'fav', 'favorite', 'favourite', 'salute', 'o7', 'uwu', 'owo', 'woo', 'woohoo',
		'hooray', 'hurray', 'lets go', 'letsgo', 'lfg', 'hell yeah', 'heck yeah', 'hell yes', 'heck yes',
		'aww', 'awww', 'smile', 'welcome', 'youre welcome', 'no problem', 'np', 'well played', 'nailed it',
		'on point', 'spot on', '10 10', '100', 'a plus', 'bussin', 'chef kiss', 'chefs kiss', 'good stuff',
		'great job', 'great work', 'good work', 'nice work', 'nice job', 'so good', 'so cool', 'very good',
		'very nice', 'very cool', 'the best', 'you rock', 'rock', 'rocks', 'you rule', 'rules', 'legit',
		'ok', 'okay', 'k', 'kk', 'alright', 'sure', 'fine', 'cool cool', 'nice nice', 'gj', 'wp', 'ggs',
		'thanks lb', 'good lb', 'flattered', 'biggrin', 'widesmile', 'glee', 'serene', 'ayy', 'popteamlospec',
		'coolguy', 'grinny', 'smiles', 'happy for you', 'happy birthday', 'hbd', 'gm', 'gn', 'good morning',
		'good night', 'goodnight', 'hi', 'hello', 'hey', 'heya', 'hiya', 'yo', 'sup', 'howdy', 'hai', 'henlo',
		'bless you', 'thank god', 'thank goodness', 'phew', 'relief', 'good to know', 'gotcha', 'got it',
		'makes sense', 'fair', 'fair enough', 'noted', 'understood', 'agree with you', 'you are right',
		'youre right', 'ur right', 'cool beans', 'sweet as', 'ace', 'brill', 'top', 'tops', 'prime', 'premium',
		'quality', 'gold', 'golden', 'gem', 'treasure', 'star', 'superstar', 'champ', 'champion', 'boss', 'chad',
		'gigachad', 'sigma', 'alpha', 'pro', 'expert', 'master', 'skilled', 'talented', 'gifted', 'creative',
		'inspiring', 'inspired', 'motivated', 'excited', 'exciting', 'hype', 'hyped', 'stoked', 'pumped',
		'cheer', 'cheerful', 'cheery', 'jolly', 'merry', 'grateful', 'thankful', 'gratitude', 'kind', 'kindly',
		'generous', 'sweetest', 'nicest', 'coolest', 'greatest', 'bestest', 'cutest', 'loveliest', 'dearest',
		'dear', 'darling', 'honey', 'hun', 'love ya', 'luv', 'luv u', 'luv you', 'lub', 'wuv', 'heart', 'hearts',
		'thumbs up', 'thumbsup', 'clap', 'claps', 'applause', 'cheering', 'celebrate', 'party', 'confetti',
	],

	negative: [
		'bad', 'terrible', 'awful', 'horrible', 'horrid', 'worst', 'worse', 'sucks', 'suck', 'sucked', 'stupid',
		'dumb', 'dumbass', 'idiot', 'idiotic', 'moron', 'moronic', 'useless', 'worthless', 'trash', 'garbage',
		'junk', 'rubbish', 'crap', 'crappy', 'shit', 'shitty', 'poop', 'lame', 'boring', 'bored', 'annoying',
		'annoyed', 'irritating', 'irritated', 'cringe', 'cringy', 'cringey', 'ugly', 'gross', 'disgusting',
		'nasty', 'ew', 'eww', 'ewww', 'yuck', 'yikes', 'yikers', 'wrong', 'incorrect', 'false', 'disagree',
		'no', 'nope', 'nah', 'nay', 'nuh uh', 'never', 'hate', 'hated', 'hate it', 'hate you', 'hate u',
		'dislike', 'despise', 'loathe', 'shut up', 'shush', 'stfu', 'go away', 'leave', 'bye', 'get out',
		'be quiet', 'quiet', 'silence', 'stop', 'stop it', 'enough', 'wtf', 'wth', 'ugh', 'meh', 'bleh', 'blah',
		'bruh', 'smh', 'facepalm', 'fail', 'failed', 'failure', 'broken', 'broke', 'bug', 'buggy', 'glitch',
		'glitchy', 'l', 'ratio', 'cope', 'seethe', 'mald', 'skill issue', 'sad', 'sadge', 'unhappy', 'upset',
		'cry', 'crying', 'cried', 'tears', 'sob', 'sobbing', 'sobby', 'depressed', 'depressing', 'miserable',
		'pain', 'painful', 'hurt', 'hurts', 'ouch', 'oof', 'oops', 'damn', 'dammit', 'damnit', 'angry', 'mad',
		'furious', 'rage', 'raging', 'pissed', 'fuck you', 'fuck u', 'fuck off', 'fuck this', 'fuck', 'screw you',
		'screw this', 'whatever', 'boo', 'booo', 'cursed', 'scary', 'creepy', 'weird', 'weirdo', 'jerk',
		'loser', 'liar', 'lies', 'lie', 'lying', 'fake', 'scam', 'scammer', 'spam', 'spammer', 'shame',
		'shameful', 'disappointed', 'disappointing', 'disappointment', 'embarrassing', 'embarrassed', 'awkward',
		'unfortunate', 'unfortunately', 'regret', 'sorry', 'my bad', 'rip', 'f', 'dead', 'die', 'died', 'kill',
		'killed', 'kys', 'delete', 'deleted', 'banned', 'ban', 'mute', 'muted', 'kick', 'kicked', 'bonk',
		'wack', 'whack', 'mid', 'overrated', 'pathetic', 'weak', 'slow', 'laggy', 'lag', 'ignore', 'ignored',
		'ignoring', 'pointless', 'nonsense', 'unacceptable', 'bad bot', 'dumb bot', 'stupid bot', 'worst bot',
		'shut it', 'go to sleep', 'get lost', 'buzz off', 'get bent', 'no one asked', 'nobody asked',
		'who asked', 'didnt ask', 'sick of', 'tired of', 'fed up', 'done with', 'over it', 'hmph', 'hmpf',
		'grr', 'grrr', 'argh', 'aargh', 'disgruntled', 'disgrunted', 'miffed', 'sideeye', 'side eye',
		'heartbroken', 'nopixels', 'zonked', 'exasperation', 'exasperated', 'exasperating', 'pensive',
		'lol no', 'hell no', 'heck no', 'no way', 'no thanks', 'no thank you', 'not really', 'doubt it',
		'doubtful', 'sus', 'suspicious', 'sketchy', 'shady', 'evil', 'villain', 'menace', 'threat', 'rude',
		'mean', 'cruel', 'harsh', 'toxic', 'salty', 'bitter', 'petty', 'lazy', 'incompetent', 'clueless bot',
		'brainless', 'braindead', 'mindless', 'thoughtless', 'clumsy', 'sloppy', 'messy', 'busted', 'janky',
		'jank', 'scuffed', 'botched', 'ruined', 'wrecked', 'destroyed', 'trashed', 'cooked', 'its over',
		'were cooked', 'im cooked', 'doomed', 'hopeless', 'helpless', 'lost', 
		'sigh', 'sighs', 'groan', 'groans', 'cringing', 'wince', 'yikes bot',
		'nooo', 'noooo', 'nooooo', 'nuh', 'nein', 'non', 'nyet', 'negative', 'denied', 'rejected', 'declined',
		'refuse', 'refused', 'wont', 'cant', 'dont', 'stop talking', 'stop replying', 'stop it bot',
		'go home', 'youre drunk', 'ur drunk', 'bot moment', 'skill issue bot', 'get good', 'git gud',
		'touch grass', 'l bot', 'l take', 'bad take', 'worst take', 'terrible take', 'hot take', 'cold take',
		'unlucky', 'unlucky bot', 'sadly', 'alas', 'tragic', 'tragedy', 'disaster', 'catastrophe', 'nightmare',
		'ugh bot', 'why would you', 'whywouldyou', 'how dare you', 'how dare', 
		'come on', 'cmon', 'oh no', 'oh god', 'oh dear', 'good grief',
		'jeez', 'geez', 'sheesh', 'yeesh', 'welp', 'oof bot', 'big oof', 'thats rough', 'rough', 'brutal',
		'savage', 'ouch bot', 'burn', 'burned', 'roasted', 'owned', 'rekt', 'wrecked bot', 'get rekt',
		'no u', 'no you', 'not you', 'nobody likes you', 'no one likes you', 'nobody cares', 'no one cares',
		'who cares', 'dont care', 'idc', 'idgaf', 'dgaf', 'whatever bot', 'yawn', 'zzz', 'snore', 'sleepy',
		'boring bot', 'dull', 'tedious', 'monotonous', 'repetitive', 'spammy', 'noisy', 'loud', 'obnoxious',
		'insufferable', 'unbearable', 'intolerable', 'unpleasant', 'distasteful', 'tasteless', 'crass',
		'vulgar', 'gross bot', 'nasty bot', 'ew bot', 'yuck bot', 'blegh', 'bleugh', 'urgh', 'ugh no',
		'pls no', 'please no', 'plz no', 'please stop', 'pls stop', 'plz stop', 'make it stop', 'stahp',
		'craig', 'acreature', 'ooohhh', 'saurry', 'coolsob', 'reallygrrl', 'pensivecowboy', 'lookup', 'xx',
		'painscream', 'uh', 'uhh', 'uhhh', 'um', 'umm', 'ummm', 'er', 'err', 'erm', 'uh oh', 'uhoh', 
	],
};


// --------------------------------------------------------- negation

//"not good", "isnt funny", "never smart" - anything up to WINDOW tokens after
//one of these, inside the same clause, means the opposite
const NEGATORS = new Set([
	'not', 'no', 'never', 'isnt', 'arent', 'wasnt', 'werent', 'aint', 'dont', 'doesnt', 'didnt', 'cant',
	'cannot', 'couldnt', 'wont', 'wouldnt', 'shouldnt', 'hardly', 'barely', 'nothing', 'nobody', 'neither',
	'nor', 'without', 'less', 'least', 'anything but', 'far from', 'nowhere near', 'unfunny', 'nah',
]);
const NEGATION_WINDOW = 3;

//a negation does not reach past one of these
const CLAUSE_BREAKS = new Set(['but', 'and', 'though', 'although', 'however', 'yet', 'except', 'still', 'because', 'cause', 'cuz', 'so']);


// ------------------------------------------------------- normalizing

//things that would be destroyed by stripping punctuation, turned into words
//first. longer keys go first so ":-)" is seen before ":)"
const EMOTICONS = {
	'</3': 'heartbroken', '<3': 'love', ':-)': 'happy', ':)': 'happy', '(:': 'happy', ':-d': 'happy', ':d': 'happy',
	'=)': 'happy', '^^': 'happy', '^_^': 'happy', ':-(': 'sad', ':(': 'sad', '):': 'sad', ':\'(': 'crying', 't_t': 'crying',
	't.t': 'crying', ';_;': 'crying', ':/': 'meh', ':\\': 'meh', ':|': 'meh', '-_-': 'ugh', '-.-': 'ugh', ';)': 'wink',
	';-)': 'wink', ':p': 'silly', ':-p': 'silly', ':o': 'woah', ':3': 'cute',
	'>:(': 'angry', '>:[': 'angry', ':@': 'angry', 'd:': 'yikes', ':s': 'meh', '10/10': '10 10',
	'a+': 'a plus', 'w/e': 'whatever',
};

const UNICODE_EMOJI = {
	'👍': 'good', '👍🏻': 'good', '👍🏼': 'good', '👍🏽': 'good', '👍🏾': 'good', '👍🏿': 'good', '❤': 'love', '❤️': 'love',
	'🧡': 'love', '💛': 'love', '💚': 'love', '💙': 'love', '💜': 'love', '🖤': 'love', '🤍': 'love', '🤎': 'love',
	'💖': 'love', '💗': 'love', '💓': 'love', '💞': 'love', '💕': 'love', '💘': 'love', '💝': 'love', '♥': 'love', '♥️': 'love',
	'❤️‍🔥': 'hot', '😂': 'lol', '🤣': 'lol', '💀': 'lol', '😹': 'lol', '😆': 'lol', '😍': 'love', '🥰': 'love',
	'😻': 'love', '😊': 'happy', '🙂': 'happy', '😀': 'happy', '😃': 'happy', '😄': 'happy', '😁': 'happy', '😸': 'happy',
	'☺': 'happy', '☺️': 'happy', '👏': 'bravo', '🔥': 'fire', '💯': '100', '✨': 'nice', '🎉': 'yay', '🥳': 'yay', '🎊': 'yay',
	'🙏': 'thanks', '🫡': 'salute', '🥺': 'cute', '🤗': 'hug', '🫶': 'love', '👋': 'hello', '😇': 'sweet', '🤩': 'wow',
	'😎': 'cool', '🆒': 'cool', '👌': 'perfect', '💪': 'strong', '🏆': 'winner', '⭐': 'star', '🌟': 'star', '💫': 'star',
	'👎': 'bad', '👎🏻': 'bad', '👎🏼': 'bad', '👎🏽': 'bad', '👎🏾': 'bad', '👎🏿': 'bad', '😡': 'angry', '😠': 'angry',
	'🤬': 'angry', '😢': 'sad', '😭': 'sad', '😿': 'sad', '😞': 'sad', '😔': 'sad', '😟': 'sad', '☹': 'sad', '☹️': 'sad',
	'🙁': 'sad', '😥': 'sad', '😓': 'sad', '😩': 'sad', '😫': 'sad', '💔': 'heartbroken', '🙄': 'ugh', '😒': 'meh',
	'😑': 'meh', '😐': 'meh', '🤮': 'gross', '🤢': 'gross', '💩': 'poop', '🤨': 'sideeye', '😤': 'hmph', '🖕': 'fuck you',
	'😬': 'awkward', '😱': 'scary', '😨': 'scary', '😰': 'scary', '🤡': 'clown', '🚫': 'no', '❌': 'no', '⛔': 'no',
	'✅': 'yes', '☑': 'yes', '☑️': 'yes', '✔': 'yes', '✔️': 'yes', '😏': 'smirk', '😘': 'kiss', '😗': 'kiss', '😙': 'kiss',
	'😚': 'kiss', '💋': 'kiss', '🥵': 'hot', '😉': 'wink', '🍕': 'pizza', '🧠': 'smart', '🤔': 'think', '🤓': 'nerd',
	'🧐': 'think', '💡': 'smart', '🎓': 'smart', '😴': 'boring', '🥱': 'boring', '💤': 'boring', '😵': 'zonked',
	'😵‍💫': 'zonked', '🫠': 'meh', '🫤': 'meh', '😮‍💨': 'sigh', '😪': 'sad', '🤷': 'whatever', '🤷‍♂️': 'whatever',
	'🤷‍♀️': 'whatever', '🙃': 'meh', '😶': 'meh', '🫥': 'meh',
};

//longest first so "</3" wins over "<3" and ":-)" over ":)". an emoticon may
//sit right against a word ("thanks:)") but may not be found inside one - so
//one that starts with a letter or digit needs a boundary before it, and
//none of them may run straight into a word
const EMOTICON_PATTERNS = Object.keys(EMOTICONS)
	.sort((a, b) => b.length - a.length)
	.map(key => {
		const before = /[\p{L}\p{N}]/u.test(key[0]) ? '(?<![\\p{L}\\p{N}])' : '';
		const escaped = key.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
		return {regex: new RegExp(before + escaped + '(?![\\p{L}\\p{N}])', 'gu'), word: EMOTICONS[key]};
	});
const UNICODE_KEYS = Object.keys(UNICODE_EMOJI).sort((a, b) => b.length - a.length);


function replaceAll (text, from, to) {
	return text.split(from).join(' ' + to + ' ');
}


//lowercase words separated by single spaces, with the mentions, emoji and
//emoticons of a discord message turned into words the lists can see
export function normalize (text) {
	let out = String(text || '');

	//<@123>, <@!123>, <@&123>, <#123> - whoever or whatever it is, it is not a word
	out = out.replace(/<@[!&]?\d+>/g, ' ').replace(/<#\d+>/g, ' ');

	//<:name:123> and <a:name:123> - the name of a server emoji is a word
	out = out.replace(/<a?:(\w+):\d+>/g, ' $1 ');

	//:name: typed by hand, in case the emoji does not exist and was not converted
	out = out.replace(/(^|\s):(\w+):(?=\s|$)/g, '$1 $2 ');

	//urls are not words either
	out = out.replace(/https?:\/\/\S+/g, ' ');

	for (const key of UNICODE_KEYS) out = replaceAll(out, key, UNICODE_EMOJI[key]);

	out = out.toLowerCase();

	for (const {regex, word} of EMOTICON_PATTERNS) out = out.replace(regex, ' ' + word + ' ');

	//"isn't" -> "isnt", "you're" -> "youre", so the lists need one spelling
	out = out.replace(/[''`]/g, '');

	//clause punctuation is kept as a marker so negation cannot cross it
	out = out.replace(/[,.;:!?\n()[\]{}"]+/g, ' | ');

	//everything else that is not a word character is a space. accented
	//letters are kept
	out = out.replace(/[^\p{L}\p{N}|]+/gu, ' ');

	return out.replace(/\s+/g, ' ').trim();
}


// ---------------------------------------------------------- matching

//each list entry as an array of tokens, longest phrases first so "thank you"
//is found before "thank" would eat it
const PHRASES = {};
for (const category of CATEGORIES) {
	PHRASES[category] = WORDS[category]
		.map(entry => normalize(entry).split(' ').filter(Boolean))
		.filter(tokens => tokens.length)
		.sort((a, b) => b.length - a.length);
}

const NEGATOR_PHRASES = [...NEGATORS].map(entry => normalize(entry).split(' ')).sort((a, b) => b.length - a.length);


function matchesAt (tokens, index, phrase) {
	if (index + phrase.length > tokens.length) return false;
	for (let i = 0; i < phrase.length; i++) if (tokens[index + i] !== phrase[i]) return false;
	return true;
}


//true if a negator sits within NEGATION_WINDOW tokens before index, without a
//clause break in between
function isNegated (tokens, index) {
	for (let back = 1; back <= NEGATION_WINDOW && index - back >= 0; back++) {
		const at = index - back;
		const token = tokens[at];
		if (token === '|' || CLAUSE_BREAKS.has(token)) return false;
		for (const negator of NEGATOR_PHRASES) if (matchesAt(tokens, at, negator)) return true;
	}
	return false;
}


//everything the lists recognise in the text, in order, each with the
//category it counts for after negation
export function findHits (text) {
	const tokens = normalize(text).split(' ').filter(Boolean);
	const hits = [];

	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i] === '|') continue;

		let longest = null;
		for (const category of CATEGORIES) {
			for (const phrase of PHRASES[category]) {
				if (!matchesAt(tokens, i, phrase)) continue;
				if (!longest || phrase.length > longest.phrase.length) longest = {category, phrase};
				break; //phrases are sorted longest first, so the first match is the longest in this category
			}
		}

		if (!longest) continue;

		//a token that is only a negator ("no", "nah") should not be scored as
		//negative when it is negating something that comes after it
		const negatesFollowing = NEGATORS.has(tokens[i]) && nextScoredToken(tokens, i, longest.phrase.length);
		if (negatesFollowing) {i += longest.phrase.length - 1; continue;}

		const negated = isNegated(tokens, i);
		hits.push({
			phrase: longest.phrase.join(' '),
			category: negated ? OPPOSITE[longest.category] : longest.category,
			negated,
			at: i,
		});

		i += longest.phrase.length - 1;
	}

	return hits;
}


//is there a list word within the negation window after this one, in the same
//clause? used to tell "no" the answer from "no" the negator in "no good"
function nextScoredToken (tokens, index, length) {
	for (let ahead = length; ahead < length + NEGATION_WINDOW && index + ahead < tokens.length; ahead++) {
		const token = tokens[index + ahead];
		if (token === '|' || CLAUSE_BREAKS.has(token)) return false;
		for (const category of CATEGORIES)
			for (const phrase of PHRASES[category])
				if (matchesAt(tokens, index + ahead, phrase)) return true;
	}
	return false;
}


// ------------------------------------------------------------ verdict

//"no" on its own is answered with yes, and "yes" on its own with no. the
//whole message has to be that one word, give or take punctuation and a ping
export function isBareWord (text, word) {
	const tokens = normalize(text).split(' ').filter(token => token && token !== '|');
	return tokens.length > 0 && tokens.every(token => token === word);
}


//the category the message is about, or null when nothing in it is recognised
export function classify (text) {
	const hits = findHits(text);
	if (!hits.length) return null;

	const score = {};
	const last = {};
	for (const hit of hits) {
		score[hit.category] = (score[hit.category] || 0) + 1;
		last[hit.category] = hit.at;
	}

	//most hits wins. on a tie a specific category (pizza, smart, sexy, funny)
	//beats a general one, because "ur so beautiful <3" is about the beautiful;
	//otherwise whichever was said last
	const generic = category => category === 'positive' || category === 'negative';

	return Object.keys(score).sort((a, b) =>
		(score[b] - score[a])
		|| (generic(a) - generic(b))
		|| (last[b] - last[a])
		|| (SPECIFICITY.indexOf(a) - SPECIFICITY.indexOf(b))
	)[0];
}


export default { CATEGORIES, normalize, findHits, classify, isBareWord };

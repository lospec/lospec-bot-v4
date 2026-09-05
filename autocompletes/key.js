// Suggests the keys that already exist in whichever store was picked. New keys
// can still be typed in - autocomplete only suggests, it does not restrict.
import { STORES } from '../data.js';

export default async function configKeyAutocomplete (interaction) {
	const slug = interaction.options.getString('store');
	const store = STORES[slug];
	if (!store) return [];

	const focused = interaction.options.getFocused().trim();
	const keys = store.keys().sort().filter(key => key.toLowerCase().includes(focused.toLowerCase()));

	const suggestions = keys.slice(0, 24).map(key => ({name: key, value: key}));

	//so it is obvious that typing something new makes a new key
	if (focused && !keys.includes(focused))
		suggestions.unshift({name: focused + '  (new key)', value: focused});

	return suggestions;
}

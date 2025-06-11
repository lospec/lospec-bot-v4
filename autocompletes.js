// Loads autocompletes and handles autocomplete interactions
import { glob } from 'glob';
import client from './client.js';
import path from 'path';

const AUTOCOMPLETES = {};

client.once('ready', async c => {
    let autocompleteFileList = glob.sync('./autocompletes/*.js');
    for (let autocompletePath of autocompleteFileList) {
        let autocompleteName = path.basename(autocompletePath, '.js');
        if (autocompleteName === 'autocompletes') continue; // skip this loader file
        let autocomplete;
        try { autocomplete = (await import('./' + autocompletePath)).default; }
        catch (err) {
            console.error('Failed to load autocomplete:', autocompleteName);
            console.error(err);
            continue;
        }
        AUTOCOMPLETES[autocompleteName] = autocomplete;
        console.log('Loaded autocomplete:', autocompleteName);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;
    const focusedOption = interaction.options.getFocused(true);
    console.log('Autocomplete triggered for:', focusedOption.name, 'with value:', focusedOption.value);
    const handler = AUTOCOMPLETES[focusedOption.name];
    if (!handler) return;
    try {
        let results = await handler(interaction);
        if (!Array.isArray(results)) results = [];
        // If array of strings, convert to { name, value }
        results = results.map(entry => {
            if (typeof entry === 'string') return { name: entry, value: entry };
            if (entry && typeof entry === 'object' && 'name' in entry && 'value' in entry) return entry;
            return null;
        }).filter(Boolean);
        await interaction.respond(results.slice(0, 25));
    } catch (err) {
        console.error('Autocomplete error:', err);
    }
});

export default AUTOCOMPLETES;

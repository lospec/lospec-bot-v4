import { getSession, setVolume, reply } from '../../util/music-player.js';

export default async (interaction) => {
	const session = getSession(interaction.guildId);
	if (!session) return interaction.reply({content: 'Nothing is playing.', ephemeral: true});

	const volume = interaction.options.getInteger('volume');
	setVolume(session, volume);
	await reply(interaction, session, interaction.user.toString() + ' set the volume to ' + volume + '%.');
};

import { code } from '../../util/music-library.js';
import { getSession, skip, reply } from '../../util/music-player.js';

export default async (interaction) => {
	const session = getSession(interaction.guildId);
	if (!session?.current) return interaction.reply({content: 'Nothing is playing.', ephemeral: true});

	const song = session.current.name;
	skip(session);
	await reply(interaction, session, interaction.user.toString() + ' skipped ' + code(song) + '.');
};

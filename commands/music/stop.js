import { getSession, leave, reply } from '../../util/music-player.js';

export default async (interaction) => {
	const session = getSession(interaction.guildId);
	if (!session) return interaction.reply({content: 'Nothing is playing.', ephemeral: true});

	leave(interaction.guildId);
	await reply(interaction, session, interaction.user.toString() + ' stopped the music.');
};

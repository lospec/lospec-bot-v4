import { requireAdmin } from '../../util/config-store.js';
import { markTradeable, unmarkTradeable, sweepForFreeRoles } from '../../util/auction-role.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	try {requireAdmin(interaction);}
	catch (err) {return interaction.editReply({content: err.message});}

	const role = interaction.options.getRole('role');
	const tradeable = interaction.options.getBoolean('tradeable');

	try {
		if (!tradeable) {
			await unmarkTradeable(role.id);
			return interaction.editReply({content: role.toString() + ' can no longer be traded. Whoever has it keeps it.'});
		}

		await markTradeable(role, interaction.user.id);
	}
	catch (err) {
		return interaction.editReply({content: err.message});
	}

	await interaction.editReply({
		content: role.toString() + ' is now tradeable. Whoever has it can auction it or give it away, and if they '
			+ 'leave the server it goes back up for auction on its own.\n\n'
			+ 'If nobody has it, it will be auctioned off by the treasury shortly.',
	});

	//a role nobody has goes straight on the market, rather than waiting for the
	//next sweep to notice it
	try {await sweepForFreeRoles(true);}
	catch (err) {console.error('Could not check the tradeable roles after a change', err);}
};

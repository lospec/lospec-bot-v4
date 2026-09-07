import { withLock } from '../../util/lock.js';
import { dm, SOLD_COLOR } from '../../util/auctions.js';
import { isTradeable, openAuctionForRole, transferRole } from '../../util/auction-role.js';

export default async (interaction) => {
	await interaction.deferReply({ephemeral: true});

	if (!interaction.guild) return interaction.editReply({content: 'This only works in a server.'});

	const role = interaction.options.getRole('role');
	const recipient = interaction.options.getUser('user');

	if (!isTradeable(role.id))
		return interaction.editReply({content: role.toString() + ' is not a tradeable role. `/role list` shows the ones that are.'});

	if (recipient.bot) return interaction.editReply({content: 'You cannot give a role to a bot.'});
	if (recipient.id === interaction.user.id) return interaction.editReply({content: 'You already have that one.'});

	if (!interaction.member.roles.cache.has(role.id))
		return interaction.editReply({content: 'You do not have ' + role.toString() + '.'});

	if (openAuctionForRole(role.id))
		return interaction.editReply({content: role.toString() + ' is up for auction right now, so you cannot give it away.'});

	try {
		await withLock('role-' + role.id, async () => {
			//re-checked inside the lock in case it moved on while we waited
			if (openAuctionForRole(role.id)) throw new Error('That role went up for auction.');

			await transferRole({
				guild: interaction.guild,
				roleId: role.id,
				fromUserId: interaction.user.id,
				toUserId: recipient.id,
				reason: 'given away by ' + interaction.user.tag,
			});
		});
	}
	catch (err) {
		return interaction.editReply({content: 'That role could not be given away. ' + err.message});
	}

	console.log(interaction.user.id, 'gave role', role.id, 'to', recipient.id);

	await interaction.editReply({content: 'You gave ' + role.toString() + ' to ' + recipient.toString() + '.'});

	await dm(recipient.id, {
		embeds: [{
			title: 'You were given a role!',
			description: interaction.user.toString() + ' gave you the **@' + role.name + '** role in **' + interaction.guild.name + '**. '
				+ 'It is yours until you auction it off or give it away.',
			color: SOLD_COLOR,
		}],
	});
};

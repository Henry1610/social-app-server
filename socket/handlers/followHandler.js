import { followEvents } from '../events/followEvents.js';
import { followUserService } from '../../services/followService.js';
export const followHandler = (io, socket) => {
	// Lấy userId từ auth hoặc query
	const userId = socket.handshake?.auth?.userId || socket.handshake?.query?.userId;

	if (!userId) {
		socket.emit('follow:error', { message: 'User ID required' });
		return;
	}

	// Follow user
	socket.on('follow:follow', async (data) => {
		try {
			const { followingUsername } = data;
			if (!followingUsername) {
				socket.emit('follow:error', { message: 'Username is required' });
				return;
			}

			// Lấy userId từ username
			const targetUser = await prisma.user.findUnique({
				where: { username: followingUsername },
				select: { id: true, username: true, fullName: true, avatarUrl: true }
			});

			if (!targetUser) {
				socket.emit('follow:error', { message: 'User not found' });
				return;
			}

			const followingId = targetUser.id;
			const userId = socket.handshake.auth?.userId;

			// Gọi service
			const result = await followUserService(userId, followingId);

			if (result.success) {
				socket.emit('follow:success', result);

				const actor = await prisma.user.findUnique({
					where: { id: userId },
					select: { id: true, username: true, fullName: true, avatarUrl: true }
				});

				if (result.type === 'follow') {
					followEvents.emit('follow_completed', { actor, targetUserId: followingId });
				} else if (result.type === 'follow_request') {
					followEvents.emit('follow_request_sent', { actor, targetUserId: followingId });
				}
			} else {
				socket.emit('follow:error', result);
			}

		} catch (error) {
			console.error('Error following user:', error);
			socket.emit('follow:error', { message: 'Server error while following user' });
		}
	});


	// Unfollow user
	socket.on('follow:unfollow', async (data) => {
		try {
			const { followingId } = data;

			if (!followingId) {
				socket.emit('follow:error', { message: 'Following ID is required' });
				return;
			}

			// Import service
			const { unfollowUserService } = await import('../../services/followService.js');

			// Gọi service
			const result = await unfollowUserService(userId, Number(followingId));

			if (result.success) {
				socket.emit('follow:success', result);
			} else {
				socket.emit('follow:error', result);
			}

		} catch (error) {
			console.error('Error unfollowing user:', error);
			socket.emit('follow:error', { message: 'Server error while unfollowing user' });
		}
	});

	// Handle disconnect
	socket.on('disconnect', () => {
		console.log(`User ${userId} disconnected from follow handler`);
	});
} 
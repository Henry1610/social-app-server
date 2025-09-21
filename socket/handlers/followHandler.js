export const followHandler = (io, socket) => {
	// Lấy userId từ auth hoặc query
	const userId = socket.handshake?.auth?.userId || socket.handshake?.query?.userId;
	
	if (!userId) {
		socket.emit('follow:error', { message: 'User ID required' });
		return;
	}

	// Test connection
	socket.on('follow:ping', () => {
		socket.emit('follow:pong', { message: 'Follow handler connected' });
	});

	// Follow user
	socket.on('follow:follow', async (data) => {
		try {
			const { followingId } = data;
			
			if (!followingId) {
				socket.emit('follow:error', { message: 'Following ID is required' });
				return;
			}

			const { followUserService } = await import('../../services/followService.js');

			const result = await followUserService(userId, Number(followingId));

			if (result.success) {
				socket.emit('follow:success', result);
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
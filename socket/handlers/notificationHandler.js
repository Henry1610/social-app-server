export const notificationHandler = (io, socket) => {
	// If client sends userId in auth or query, join personal room for notifications
	const userId = socket.handshake?.auth?.userId || socket.handshake?.query?.userId
	if (userId) {
		socket.join(`user_${userId}`)
		console.log(`User ${userId} joined notification room`)
	}

	// Join notification room manually
	socket.on('notif:join', (data) => {
		const { userId: targetUserId } = data
		if (targetUserId) {
			socket.join(`user_${targetUserId}`)
			socket.emit('notif:joined', { room: `user_${targetUserId}` })
			console.log(`User joined notification room: user_${targetUserId}`)
		}
	})

	// Leave notification room
	socket.on('notif:leave', (data) => {
		const { userId: targetUserId } = data
		if (targetUserId) {
			socket.leave(`user_${targetUserId}`)
			socket.emit('notif:left', { room: `user_${targetUserId}` })
			console.log(`User left notification room: user_${targetUserId}`)
		}
	})

	// Handle notification read status
	socket.on('notif:mark_read', async (data) => {
		const { notificationId, userId: targetUserId } = data
		if (notificationId && targetUserId) {
			try {
				// Import here to avoid circular dependency
				const { markNotificationAsRead } = await import('../../services/notificationService.js')
				const success = await markNotificationAsRead(notificationId, targetUserId)
				
				if (success) {
					socket.emit('notif:marked_read', { notificationId, success: true })
				} else {
					socket.emit('notif:marked_read', { notificationId, success: false, error: 'Notification not found' })
				}
			} catch (error) {
				console.error('Error marking notification as read:', error)
				socket.emit('notif:marked_read', { notificationId, success: false, error: error.message })
			}
		}
	})

	// Handle mark all notifications as read
	socket.on('notif:mark_all_read', async (data) => {
		const { userId: targetUserId } = data
		if (targetUserId) {
			try {
				// Import here to avoid circular dependency
				const { markAllNotificationsAsRead } = await import('../../services/notificationService.js')
				await markAllNotificationsAsRead(targetUserId)
				socket.emit('notif:all_marked_read', { success: true })
			} catch (error) {
				console.error('Error marking all notifications as read:', error)
				socket.emit('notif:all_marked_read', { success: false, error: error.message })
			}
		}
	})

	// Handle disconnect
	socket.on('disconnect', () => {
		console.log(`User ${userId} disconnected from notifications`)
	})
} 
import { getIO } from '../config/socket.js'
import { followHandler } from './handlers/followHandler.js'
import { notificationHandler } from './handlers/notificationHandler.js'

export const registerSocketHandlers = () => {
    const io = getIO()

    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        if (userId) {
            socket.join(`user_${userId}`);
            console.log(`User ${userId} joined room user_${userId}`);
        }

        // Register handlers
        // followHandler(io, socket);
        // notificationHandler(io, socket);

        socket.on('disconnect', () => {
            console.log("User disconnected:", socket.id);
        })
    })
}

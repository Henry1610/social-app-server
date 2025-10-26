import { getIO } from '../config/socket.js'
import { registerChatHandlers } from './handlers/chatHandlers.js'

export const registerSocketHandlers = () => {
    const io = getIO()

    // Register chat handlers
    registerChatHandlers();

    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        if (userId) {
            socket.join(`user_${userId}`);
            console.log(`User ${userId} joined room user_${userId}`);
        }

        socket.on('disconnect', () => {
            console.log("User disconnected:", socket.id);
        })
    })
}

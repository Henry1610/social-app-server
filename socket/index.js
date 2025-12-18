import { getIO } from '../config/socket.js'
import { registerChatHandlers } from './handlers/chatHandlers.js'

export const registerSocketHandlers = () => {
    const io = getIO()

    // Register chat handlers
    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        
        if (userId) {
            socket.join(`user_${userId}`);
        }
        
        // Đăng ký các chat handlers cho socket này
        registerChatHandlers(socket, userId);
    })
}

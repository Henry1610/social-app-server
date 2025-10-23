import { getIO } from '../config/socket.js'

export const registerSocketHandlers = () => {
    const io = getIO()

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

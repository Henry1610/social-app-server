import { getIO } from '../config/socket.js'
import { notificationHandler } from "./handlers/notificationHandler.js";
import { followHandler } from "./handlers/followHandler.js";

export const registerSocketHandlers = () => {
    const io = getIO()

    io.on('connection', (socket) => {
        console.log('New socket connection:', socket.id);
        
        // Register all handlers
        notificationHandler(io, socket);
        followHandler(socket, io);
        
        socket.on('disconnect', () => {
            console.log("User disconnected:", socket.id);
        })
    })
}

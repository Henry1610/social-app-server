import { getIO } from '../../config/socket.js';
import { handleUserConnected } from './connectionHandler.js';
import { registerConversationHandlers } from './conversationHandlers.js';
import { registerMessageHandlers } from './messageHandlers.js';
import { registerStatusHandlers } from './statusHandlers.js';
import { registerGroupHandlers } from './groupHandlers.js';

// Đăng ký tất cả chat handlers
export const registerChatHandlers = (socket, userId) => {
    const io = getIO();

        if (!userId) {
            socket.disconnect();
            return;
        }

    // Xử lý khi user kết nối
    handleUserConnected(io, socket, userId);

    // Đăng ký các handlers
    registerConversationHandlers(socket, userId, io);
    registerMessageHandlers(socket, userId, io);
    registerStatusHandlers(socket, userId, io);
    registerGroupHandlers(socket, userId, io);
};

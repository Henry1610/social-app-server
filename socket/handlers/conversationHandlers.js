import { checkConversationAccess } from '../../services/conversationService.js';
import { markMessagesAsRead } from './helpers/chatHelpers.js';

// Xử lý join conversation
export const registerConversationHandlers = (socket, userId, io) => {
    // Join conversation
    socket.on('chat:join_conversation', async (conversationId) => {
        try {
            // Check if user has access to conversation
            const hasAccess = await checkConversationAccess(userId, conversationId);
            if (!hasAccess) {
                socket.emit('chat:error', { message: 'Không có quyền truy cập cuộc trò chuyện này' });
                return;
            }

            // Kiểm tra xem đã join phòng chưa để tránh join trùng lặp
            const roomName = `conversation_${conversationId}`;
            const isAlreadyInRoom = socket.rooms.has(roomName);
            if (!isAlreadyInRoom) {
                socket.join(roomName);
            }

            // Join phòng active để đánh dấu đang xem conversation
            const activeRoomName = `active_conversation_${conversationId}`;
            const isAlreadyInActive = socket.rooms.has(activeRoomName);
            if (!isAlreadyInActive) {
                socket.join(activeRoomName);
            }

            socket.data.activeConversationId = parseInt(conversationId);

            // Đánh dấu tất cả tin nhắn chưa đọc thành READ
            const unreadMessages = await markMessagesAsRead(conversationId, userId);

            // Emit event để frontend biết cần refetch messages
            // Điều này đảm bảo khi user join lại conversation, sẽ thấy tất cả tin nhắn mới
            socket.emit('chat:conversation_joined', {
                conversationId: parseInt(conversationId)
            });

            // Emit event để cập nhật realtime
            if (unreadMessages.length > 0) {
                // Emit unread count update để cập nhật sidebar
                socket.emit('chat:unread_count_update', {
                    conversationId,
                    action: 'decrement'
                });

                // Emit conversation update để cập nhật sidebar
                socket.emit('chat:conversation_updated', {
                    conversationId,
                    action: 'read'
                });
            }
        } catch (error) {
            console.error('Error joining conversation:', error);
            socket.emit('chat:error', { message: 'Có lỗi xảy ra khi tham gia cuộc trò chuyện' });
        }
    });

    // Leave conversation room
    socket.on('chat:leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        // Leave phòng active tương ứng
        socket.leave(`active_conversation_${conversationId}`);
        if (socket.data.activeConversationId === parseInt(conversationId)) {
            delete socket.data.activeConversationId;
        }
    });
};


import prisma from '../../utils/prisma.js';
import { checkConversationAccess } from '../../services/conversationService.js';
import { getUserConversations, getConversationMembers, markMessagesAsRead, notifyUserStatus } from './helpers/chatHelpers.js';

// Xử lý các event liên quan đến trạng thái (typing, seen, disconnect)
export const registerStatusHandlers = (socket, userId, io) => {
    // Typing indicator
    socket.on('chat:typing', async (data) => {
        const { conversationId, isTyping } = data;

        // Emit to conversation room (for ChatMain)
        socket.to(`conversation_${conversationId}`).emit('chat:user_typing', {
            userId,
            isTyping,
            conversationId
        });

        // Also emit to all conversation members' user rooms (for ChatSidebar)
        try {
            const conversationMembers = await getConversationMembers(conversationId, userId);

            conversationMembers.forEach(member => {
                socket.to(`user_${member.userId}`).emit('chat:user_typing', {
                    userId,
                    isTyping,
                    conversationId
                });
            });
        } catch (error) {
            console.error('Error getting conversation members for typing:', error);
        }
    });

    // Handle message seen - chuyển từ DELIVERED thành READ từ mới nhất đổ về trước
    socket.on('message:seen', async (data) => {
        try {
            const { conversationId, userId: viewerId } = data;

            // Verify user has access to conversation
            const hasAccess = await checkConversationAccess(viewerId, conversationId);
            if (!hasAccess) {
                socket.emit('error', { message: 'No access to conversation' });
                return;
            }

            // Lấy tất cả tin nhắn SENT và DELIVERED của người khác trong conversation này
            // Sắp xếp từ mới nhất đến cũ nhất
            const unreadMessages = await markMessagesAsRead(conversationId, viewerId);

            if (unreadMessages.length > 0) {
                // Thông báo cho người gửi về việc tin nhắn đã được đọc
                const uniqueSenders = [...new Set(unreadMessages.map(msg => msg.senderId))];
                const messageIds = unreadMessages.map(msg => msg.id);

                uniqueSenders.forEach(senderId => {
                    // Thông báo cho người gửi về việc tin nhắn đã được đọc
                    io.to(`user_${senderId}`).emit('message:status_update', {
                        messageIds: messageIds,
                        status: 'READ',
                        conversationId: parseInt(conversationId),
                        userId: viewerId
                    });

                    // Emit unread count update để giảm count
                    io.to(`user_${senderId}`).emit('chat:unread_count_update', {
                        conversationId,
                        action: 'decrement',
                        count: unreadMessages.length
                    });
                });
            }
        } catch (error) {
            console.error('Error handling message:seen:', error);
            socket.emit('error', { message: 'Error marking messages as seen' });
        }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        try {
            // Kiểm tra user có tồn tại không
            const userExists = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true }
            });

            if (!userExists) {
                console.warn(`handleDisconnect: User ${userId} không tồn tại trong DB, bỏ qua update.`);
                return;
            }

            // Update user offline status
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isOnline: false,
                    lastSeen: new Date()
                }
            });

            // Notify all conversations that user is offline
            const userConversations = await getUserConversations(userId);

            userConversations.forEach(({ conversationId }) => {
                notifyUserStatus(io, conversationId, userId, false);
            });
        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
};


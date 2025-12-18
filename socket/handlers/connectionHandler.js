import prisma from '../../utils/prisma.js';
import { getUserConversations, notifyUserStatus } from './helpers/chatHelpers.js';

// Xử lý khi user kết nối
export const handleUserConnected = async (io, socket, userId) => {
    try {
        const existingUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        if (!existingUser) {
            console.warn(`handleUserConnected: User ${userId} không tồn tại trong DB, bỏ qua update.`);
            return;
        }

        // Cập nhật trạng thái online
        await prisma.user.update({
            where: { id: userId },
            data: {
                isOnline: true,
                lastSeen: new Date(),
            },
        });

        // Lấy danh sách conversations của user
        const userConversations = await getUserConversations(userId);

        // Thông báo trạng thái online cho tất cả conversations
        userConversations.forEach(({ conversationId }) => {
            notifyUserStatus(io, conversationId, userId, true);
        });

        // Join vào các phòng conversation
        userConversations.forEach(({ conversationId }) => {
            socket.join(`conversation_${conversationId}`);
        });

        // Cập nhật trạng thái tin nhắn từ SENT thành DELIVERED
        const sentMessages = await prisma.message.findMany({
            where: {
                deletedAt: null,
                senderId: { not: userId },
                states: {
                    some: {
                        userId: userId,
                        status: 'SENT',
                    },
                },
            },
            select: {
                id: true,
                senderId: true,
                conversationId: true,
            },
        });

        if (sentMessages.length > 0) {
            await prisma.messageState.updateMany({
                where: {
                    messageId: { in: sentMessages.map((msg) => msg.id) },
                    userId: userId,
                    status: 'SENT',
                },
                data: {
                    status: 'DELIVERED',
                    updatedAt: new Date(),
                },
            });
        }
    } catch (error) {
        console.error('Error handling user connected:', error);
    }
};


import prisma from '../../../utils/prisma.js';

// Lấy danh sách conversations của user
export const getUserConversations = async (userId) => {
    return await prisma.conversationMember.findMany({
        where: {
            userId,
            leftAt: null
        },
        select: { conversationId: true }
    });
};

// Lấy danh sách members của conversation
export const getConversationMembers = async (conversationId, excludeUserId = null) => {
    const where = {
        conversationId: parseInt(conversationId),
        leftAt: null,
    };

    if (excludeUserId) {
        where.userId = { not: excludeUserId };
    }

    return await prisma.conversationMember.findMany({
        where,
        select: { userId: true }
    });
};

// Đánh dấu tin nhắn là đã đọc
export const markMessagesAsRead = async (conversationId, userId) => {
    const unreadMessages = await prisma.message.findMany({
        where: {
            conversationId: parseInt(conversationId),
            deletedAt: null,
            senderId: { not: userId },
            states: {
                some: {
                    userId: userId,
                    status: { in: ['SENT', 'DELIVERED'] }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, senderId: true }
    });

    if (unreadMessages.length > 0) {
        // Cập nhật tất cả tin nhắn thành READ
        await prisma.messageState.updateMany({
            where: {
                messageId: { in: unreadMessages.map(msg => msg.id) },
                userId,
                status: { in: ['SENT', 'DELIVERED'] }
            },
            data: {
                status: 'READ',
                updatedAt: new Date(),
            },
        });

        // Cập nhật lastReadAt của conversation member
        await prisma.conversationMember.update({
            where: {
                conversationId_userId: {
                    conversationId: parseInt(conversationId),
                    userId: userId
                }
            },
            data: {
                lastReadAt: new Date()
            }
        });

        return unreadMessages;
    }

    return [];
};

// Thông báo trạng thái user (online/offline)
export const notifyUserStatus = (io, conversationId, userId, isOnline) => {
    const statusData = {
        userId,
        isOnline,
        lastSeen: new Date()
    };
    io.to(`conversation_${conversationId}`).emit('chat:user_status', statusData);
};

// Emit conversation update cho tất cả members
export const emitConversationUpdate = async (io, conversationId, action) => {
    const allMembers = await getConversationMembers(conversationId);
    allMembers.forEach(member => {
        io.to(`user_${member.userId}`).emit('chat:conversation_updated', {
            conversationId: parseInt(conversationId),
            action: action
        });
    });
};


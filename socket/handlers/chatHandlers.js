import { getIO } from '../../config/socket.js';
import prisma from '../../utils/prisma.js';
import { createMessageWithStates } from '../../services/messageService.js';
import { checkConversationAccess } from '../../services/conversationService.js';

// Helper functions để tránh lặp code
const getUserConversations = async (userId) => {
    return await prisma.conversationMember.findMany({
        where: { 
            userId,
            leftAt: null 
        },
        select: { conversationId: true }
    });
};

const getConversationMembers = async (conversationId, excludeUserId = null) => {
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

const markMessagesAsRead = async (conversationId, userId) => {
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

const notifyUserStatus = (io, conversationId, userId, isOnline) => {
    const statusData = {
        userId,
        isOnline,
        lastSeen: new Date()
    };
    io.to(`conversation_${conversationId}`).emit('chat:user_status', statusData);
};

export const registerChatHandlers = () => {
    const io = getIO();

    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        
        if (!userId) {
            socket.disconnect();
            return;
        }

        // Cập nhật trạng thái online và thông báo cho các cuộc trò chuyện
        const handleUserConnected = async () => {
            try {
                // 1. Update user online status
                await prisma.user.update({
                    where: { id: userId },
                    data: { 
                        isOnline: true,
                        lastSeen: new Date()
                    }
                });

                const userConversations = await getUserConversations(userId);

                userConversations.forEach(({ conversationId }) => {
                    notifyUserStatus(io, conversationId, userId, true);
                });

                // 3. Tham gia tất cả các phòng trò chuyện của người dùng
                userConversations.forEach(({ conversationId }) => {
                    socket.join(`conversation_${conversationId}`);
                });

                // 4. Tìm tất cả tin nhắn SENT và cập nhật thành DELIVERED
                const sentMessages = await prisma.message.findMany({
                    where: {
                        deletedAt: null,
                        senderId: { not: userId }, // Chỉ tin nhắn của người khác
                        states: {
                            some: {
                                userId: userId,
                                status: 'SENT'
                            }
                        }
                    },
                    select: { 
                        id: true, 
                        senderId: true,
                        conversationId: true
                    }
                });

                if (sentMessages.length > 0) {
                    // Cập nhật tất cả thành DELIVERED
                    await prisma.messageState.updateMany({
                        where: {
                            messageId: { in: sentMessages.map(msg => msg.id) },
                            userId: userId,
                            status: 'SENT'
                        },
                        data: { 
                            status: 'DELIVERED',
                            updatedAt: new Date()
                        }
                    });

                    // Không cần thông báo cho người gửi
                }
            } catch (error) {
                console.error('Error handling user connected:', error);
            }
        };

        handleUserConnected();

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

                // Đánh dấu tất cả tin nhắn chưa đọc thành READ
                const unreadMessages = await markMessagesAsRead(conversationId, userId);
                
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
            console.log(`User ${userId} left conversation ${conversationId}`);
        });

        // Send message
        socket.on('chat:send_message', async (data) => {
            try {
                const { conversationId, content, type = 'TEXT', replyToId } = data;

                // Check if user has access to conversation
                const hasAccess = await checkConversationAccess(userId, conversationId);
                if (!hasAccess) {
                    socket.emit('chat:error', { message: 'Không có quyền gửi tin nhắn trong cuộc trò chuyện này' });
                    return;
                }

                // Create message
                const message = await createMessageWithStates(conversationId, userId, {
                    type,
                    content,
                    replyToId
                });

                // Emit to all members in conversation
                io.to(`conversation_${conversationId}`).emit('chat:new_message', {
                    message,
                    conversationId
                });

                // Send notification to other members
                const conversationMembers = await prisma.conversationMember.findMany({
                    where: {
                        conversationId: parseInt(conversationId),
                        userId: { not: userId },
                        leftAt: null,
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true,
                            }
                        }
                    }
                });

                // Lấy danh sách socket IDs trong phòng conversation
                const roomName = `conversation_${conversationId}`;
                const socketsInRoom = io.sockets.adapter.rooms.get(roomName) || new Set();
                const socketIdsInRoom = [...socketsInRoom];
                
                // Lấy danh sách user IDs đang trong phòng conversation
                const userIdsInRoom = [];
                for (const socketId of socketIdsInRoom) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket && socket.handshake.auth?.userId) {
                        userIdsInRoom.push(socket.handshake.auth.userId);
                    }
                }
                
                console.log(`Users in conversation ${conversationId}:`, userIdsInRoom);
                
                conversationMembers.forEach(member => {
                    io.to(`user_${member.userId}`).emit('notification', {
                        type: 'MESSAGE',
                        from: {
                            username: message.sender.username,
                            avatarUrl: message.sender.avatarUrl
                        },
                        message: String(message.content || ''),
                        metadata: {
                            conversationId,
                            messageId: message.id,
                            senderId: userId
                        }
                    });
                    
                    // Kiểm tra xem người nhận có đang trong đoạn chat không
                    const isRecipientInConversation = userIdsInRoom.includes(member.userId);
                    
                    if (isRecipientInConversation) {
                        // Nếu người nhận đang trong đoạn chat, đánh dấu tin nhắn là READ ngay lập tức
                        console.log(`User ${member.userId} is in conversation ${conversationId}, marking message as READ`);
                        
                        // Cập nhật MessageState thành READ
                        prisma.messageState.updateMany({
                            where: {
                                messageId: message.id,
                                userId: member.userId
                            },
                            data: {
                                status: 'READ',
                                updatedAt: new Date()
                            }
                        }).then(() => {
                            // Thông báo cho người gửi rằng tin nhắn đã được đọc
                            io.to(`user_${userId}`).emit('message:status_update', {
                                messageIds: [message.id],
                                status: 'READ',
                                conversationId: parseInt(conversationId),
                                userId: member.userId
                            });
                        });
                    } else {
                        // Nếu người nhận không trong đoạn chat, gửi thông báo tăng số tin nhắn chưa đọc
                        io.to(`user_${member.userId}`).emit('chat:unread_count_update', {
                            conversationId,
                            action: 'increment'
                        });
                    }
                });

                // Emit conversation update to all members to refresh sidebar
                const allConversationMembers = await getConversationMembers(conversationId);

                allConversationMembers.forEach(member => {
                    io.to(`user_${member.userId}`).emit('chat:conversation_updated', {
                        conversationId,
                        action: 'update'
                    });
                });

            } catch (error) {
                console.error('Error sending message:', error);
                socket.emit('chat:error', { message: 'Có lỗi xảy ra khi gửi tin nhắn' });
            }
        });

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
                console.log('Received message:seen event:', data);
                const { conversationId, userId: viewerId } = data;
                
                // Verify user has access to conversation
                const hasAccess = await checkConversationAccess(viewerId, conversationId);
                if (!hasAccess) {
                    console.log('User has no access to conversation');
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

                    console.log(`User ${viewerId} marked ${unreadMessages.length} messages as read in conversation ${conversationId}`);
                }

            } catch (error) {
                console.error('Error handling message:seen:', error);
                socket.emit('error', { message: 'Error marking messages as seen' });
            }
        });

        // Handle disconnect
        socket.on('disconnect', async () => {
            try {
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

                console.log(`User ${userId} disconnected from chat`);
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });
};

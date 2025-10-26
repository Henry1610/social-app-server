import { getIO } from '../../config/socket.js';
import prisma from '../../utils/prisma.js';
import { createMessageWithStates } from '../../services/messageService.js';
import { checkConversationAccess } from '../../services/conversationService.js';

export const registerChatHandlers = () => {
    const io = getIO();

    io.on('connection', (socket) => {
        const userId = socket.handshake.auth?.userId;
        
        if (!userId) {
            socket.disconnect();
            return;
        }

        // Join user room
        socket.join(`user_${userId}`);
        console.log(`User ${userId} connected to chat`);

        // Update user online status
        socket.on('chat:user_online', async () => {
            try {
                await prisma.user.update({
                    where: { id: userId },
                    data: { 
                        isOnline: true,
                        lastSeen: new Date()
                    }
                });

                // Notify all conversations that user is online
                const userConversations = await prisma.conversationMember.findMany({
                    where: { 
                        userId,
                        leftAt: null 
                    },
                    select: { conversationId: true }
                });

                userConversations.forEach(({ conversationId }) => {
                    socket.to(`conversation_${conversationId}`).emit('chat:user_status', {
                        userId,
                        isOnline: true,
                        lastSeen: new Date()
                    });
                });
            } catch (error) {
                console.error('Error updating user online status:', error);
            }
        });

        // Join conversation room
        socket.on('chat:join_conversation', async (conversationId) => {
            try {
                // Check if user has access to conversation
                const hasAccess = await checkConversationAccess(userId, conversationId);
                if (!hasAccess) {
                    socket.emit('chat:error', { message: 'Không có quyền truy cập cuộc trò chuyện này' });
                    return;
                }

                socket.join(`conversation_${conversationId}`);
                console.log(`User ${userId} joined conversation ${conversationId}`);

                // Mark conversation as read
                const unreadMessages = await prisma.message.findMany({
                    where: {
                        conversationId: parseInt(conversationId),
                        deletedAt: null,
                        states: {
                            none: {
                                userId,
                                status: 'READ',
                            },
                        },
                    },
                    select: { id: true },
                });

                if (unreadMessages.length > 0) {
                    await prisma.messageState.updateMany({
                        where: {
                            messageId: {
                                in: unreadMessages.map(msg => msg.id),
                            },
                            userId,
                        },
                        data: {
                            status: 'READ',
                            updatedAt: new Date(),
                        },
                    });
                }

                socket.emit('chat:joined_conversation', { conversationId });
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

                conversationMembers.forEach(member => {
                    io.to(`user_${member.userId}`).emit('notification', {
                        type: 'MESSAGE',
                        title: 'Tin nhắn mới',
                        message: `${message.sender.fullName} đã gửi tin nhắn`,
                        data: {
                            conversationId,
                            messageId: message.id,
                            senderId: userId
                        }
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
                const conversationMembers = await prisma.conversationMember.findMany({
                    where: {
                        conversationId: parseInt(conversationId),
                        userId: { not: userId }, // Exclude sender
                        leftAt: null,
                    },
                    select: { userId: true },
                });
                
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

        // Mark message as read
        socket.on('chat:mark_read', async (data) => {
            try {
                const { messageId } = data;

                const message = await prisma.message.findUnique({
                    where: { id: parseInt(messageId) },
                });

                if (!message) return;

                // Check access
                const hasAccess = await checkConversationAccess(userId, message.conversationId);
                if (!hasAccess) return;

                // Update message state
                await prisma.messageState.upsert({
                    where: {
                        messageId_userId: {
                            messageId: parseInt(messageId),
                            userId,
                        },
                    },
                    update: {
                        status: 'READ',
                        updatedAt: new Date(),
                    },
                    create: {
                        messageId: parseInt(messageId),
                        userId,
                        status: 'READ',
                    },
                });

                // Notify sender
                socket.to(`conversation_${message.conversationId}`).emit('chat:message_read', {
                    messageId,
                    userId,
                    conversationId: message.conversationId
                });

            } catch (error) {
                console.error('Error marking message as read:', error);
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
                const userConversations = await prisma.conversationMember.findMany({
                    where: { 
                        userId,
                        leftAt: null 
                    },
                    select: { conversationId: true }
                });

                userConversations.forEach(({ conversationId }) => {
                    socket.to(`conversation_${conversationId}`).emit('chat:user_status', {
                        userId,
                        isOnline: false,
                        lastSeen: new Date()
                    });
                });

                console.log(`User ${userId} disconnected from chat`);
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });
};

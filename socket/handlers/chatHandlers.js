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

        // Edit message
        socket.on('chat:edit_message', async (data) => {
            try {
                const { messageId, content } = data;

                // Check if user has access to conversation through message
                const message = await prisma.message.findUnique({
                    where: { id: parseInt(messageId) },
                    include: { sender: true }
                });

                if (!message || message.deletedAt) {
                    socket.emit('chat:error', { message: 'Không tìm thấy tin nhắn' });
                    return;
                }

                if (message.senderId !== userId) {
                    socket.emit('chat:error', { message: 'Bạn không có quyền chỉnh sửa tin nhắn này' });
                    return;
                }

                // Only allow editing text messages
                if (message.type !== 'TEXT') {
                    socket.emit('chat:error', { message: 'Chỉ có thể chỉnh sửa tin nhắn văn bản' });
                    return;
                }

                // Check if new content is different from old content
                if (content.trim() === message.content?.trim()) {
                    socket.emit('chat:error', { message: 'Nội dung mới phải khác nội dung cũ' });
                    return;
                }

                // Save edit history before updating
                if (message.content) {
                    await prisma.messageEditHistory.create({
                        data: {
                            messageId: parseInt(messageId),
                            oldContent: message.content,
                            newContent: content.trim(),
                            editedBy: userId,
                        },
                    });
                }

                // Update message
                const updatedMessage = await prisma.message.update({
                    where: { id: parseInt(messageId) },
                    data: {
                        content: content.trim(),
                        updatedAt: new Date(),
                    },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true,
                                avatarUrl: true,
                            },
                        },
                        editHistory: {
                            include: {
                                editor: {
                                    select: {
                                        id: true,
                                        username: true,
                                        fullName: true,
                                    },
                                },
                            },
                            orderBy: {
                                editedAt: 'asc',
                            },
                        },
                    },
                });

                io.to(`conversation_${message.conversationId}`).emit('chat:message_edited', {
                    message: updatedMessage,
                    conversationId: message.conversationId
                });

                // Refresh preview tin nhắn cuối cùng
                const allConversationMembers = await getConversationMembers(message.conversationId);
                allConversationMembers.forEach(member => {
                    io.to(`user_${member.userId}`).emit('chat:conversation_updated', {
                        conversationId: message.conversationId,
                        action: 'update'
                    });
                });

            } catch (error) {
                console.error('Error editing message:', error);
                socket.emit('chat:error', { message: 'Có lỗi xảy ra khi chỉnh sửa tin nhắn' });
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

        // Handle recall message
        socket.on('chat:recall_message', async (data) => {
            try {
                const { messageId, conversationId } = data;
                const userId = socket.handshake.auth?.userId;

                if (!userId) {
                    socket.emit('chat:error', { message: 'Bạn cần đăng nhập để thực hiện hành động này' });
                    return;
                }

                // Kiểm tra quyền thu hồi tin nhắn (chỉ người gửi mới có thể thu hồi)
                const message = await prisma.message.findUnique({
                    where: { id: parseInt(messageId) },
                    include: { sender: true }
                });

                if (!message) {
                    socket.emit('chat:error', { message: 'Tin nhắn không tồn tại' });
                    return;
                }

                if (message.senderId !== userId) {
                    socket.emit('chat:error', { message: 'Bạn không có quyền thu hồi tin nhắn này' });
                    return;
                }

                // Cập nhật tin nhắn là đã thu hồi
                await prisma.message.update({
                    where: { id: parseInt(messageId) },
                    data: { 
                        isRecalled: true,
                        recalledAt: new Date()
                    }
                });

                // Emit tới tất cả members trong conversation
                io.to(`conversation_${conversationId}`).emit('chat:message_recalled', {
                    messageId: parseInt(messageId),
                    conversationId: parseInt(conversationId),
                    recalledBy: userId
                });

            } catch (error) {
                console.error('Error handling chat:recall_message:', error);
                socket.emit('chat:error', { message: 'Lỗi khi thu hồi tin nhắn' });
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

        // Handle add members to group
        socket.on('chat:add_members', async (data) => {
            try {
                const { conversationId, memberIds } = data;
                const userId = socket.handshake.auth?.userId;

                console.log(`User ${userId} adding members to conversation ${conversationId}:`, memberIds);

                // Kiểm tra quyền admin
                const conversation = await prisma.conversation.findFirst({
                    where: {
                        id: parseInt(conversationId),
                        type: 'GROUP',
                        members: {
                            some: {
                                userId: userId,
                                role: 'ADMIN',
                                leftAt: null
                            }
                        }
                    }
                });

                if (!conversation) {
                    socket.emit('chat:error', {
                        message: 'Bạn không có quyền thêm thành viên vào nhóm này'
                    });
                    return;
                }

                // Kiểm tra xem các user có tồn tại không
                const users = await prisma.user.findMany({
                    where: {
                        id: { in: memberIds.map(id => parseInt(id)) }
                    },
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        avatarUrl: true
                    }
                });

                if (users.length !== memberIds.length) {
                    socket.emit('chat:error', {
                        message: 'Một số người dùng không tồn tại'
                    });
                    return;
                }

                // Kiểm tra xem các user đã có trong group chưa
                const existingMembers = await prisma.conversationMember.findMany({
                    where: {
                        conversationId: parseInt(conversationId),
                        userId: { in: memberIds.map(id => parseInt(id)) },
                        leftAt: null
                    }
                });

                if (existingMembers.length > 0) {
                    socket.emit('chat:error', {
                        message: 'Một số người đã có trong nhóm'
                    });
                    return;
                }

                // Thêm thành viên vào group
                const newMembers = await prisma.conversationMember.createMany({
                    data: memberIds.map(memberId => ({
                        conversationId: parseInt(conversationId),
                        userId: parseInt(memberId),
                        role: 'MEMBER',
                        joinedAt: new Date()
                    }))
                });

                // Lấy thông tin chi tiết của các thành viên mới
                const addedMembers = await prisma.conversationMember.findMany({
                    where: {
                        conversationId: parseInt(conversationId),
                        userId: { in: memberIds.map(id => parseInt(id)) },
                        leftAt: null
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true,
                                avatarUrl: true,
                                isOnline: true,
                                lastSeen: true
                            }
                        }
                    }
                });

                // Emit event cho tất cả thành viên trong group
                const allMembers = await getConversationMembers(conversationId);
                allMembers.forEach(member => {
                    io.to(`user_${member.userId}`).emit('chat:members_added', {
                        conversationId: parseInt(conversationId),
                        addedMembers: addedMembers.map(m => ({
                            id: m.user.id,
                            username: m.user.username,
                            fullName: m.user.fullName,
                            avatarUrl: m.user.avatarUrl,
                            role: m.role,
                            joinedAt: m.joinedAt
                        })),
                        addedBy: {
                            id: userId,
                            username: socket.user?.username,
                            fullName: socket.user?.fullName
                        }
                    });
                });

                console.log(`Added ${newMembers.count} members to conversation ${conversationId}`);

            } catch (error) {
                console.error('Error adding members:', error);
                socket.emit('chat:error', {
                    message: 'Có lỗi xảy ra khi thêm thành viên'
                });
            }
        });
    });
};

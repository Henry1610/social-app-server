import { getIO } from '../../config/socket.js';
import prisma from '../../utils/prisma.js';
import { createMessageWithStates } from '../../services/messageService.js';
import { checkConversationAccess } from '../../services/conversationService.js';
import { createSystemMessage } from '../../services/systemMessageService.js';

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

const emitConversationUpdate = async (io, conversationId, action) => {
    const allMembers = await getConversationMembers(conversationId);
    allMembers.forEach(member => {
        io.to(`user_${member.userId}`).emit('chat:conversation_updated', {
            conversationId: parseInt(conversationId),
            action: action
        });
    });
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
                // Join phòng active để đánh dấu đang xem conversation
                const activeRoomName = `active_conversation_${conversationId}`;
                const isAlreadyInActive = socket.rooms.has(activeRoomName);
                if (!isAlreadyInActive) {
                    socket.join(activeRoomName);
                    
                }
                socket.data.activeConversationId = parseInt(conversationId);

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
            // Leave phòng active tương ứng
            socket.leave(`active_conversation_${conversationId}`);
            if (socket.data.activeConversationId === parseInt(conversationId)) {
                delete socket.data.activeConversationId;
                
            }
            
        });

        // Send message
        socket.on('chat:send_message', async (data) => {
            try {
                 const { conversationId, content, type = 'TEXT', replyToId, mediaUrl, mediaType } = data;

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
                    replyToId,
                    mediaUrl
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

                // Lấy danh sách socket IDs trong phòng active conversation
                const roomName = `active_conversation_${conversationId}`;
                const socketsInRoom = io.sockets.adapter.rooms.get(roomName) || new Set();
                const socketIdsInRoom = [...socketsInRoom];
                // Lấy danh sách user IDs đang ở phòng active conversation
                const userIdsInRoom = [];
                for (const socketId of socketIdsInRoom) {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket && socket.handshake.auth?.userId) {
                        userIdsInRoom.push(socket.handshake.auth.userId);
                    }
                }
                
                
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
                    
                    // Kiểm tra xem người nhận có đang ở phòng active conversation không
                    const isRecipientActive = userIdsInRoom.includes(member.userId);
                    if (isRecipientActive) {
                        
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

                await emitConversationUpdate(io, conversationId, 'update');

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

                await emitConversationUpdate(io, message.conversationId, 'update');

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

                
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });

        // Handle leave group
        socket.on('chat:leave_group', async (data) => {
            try {
                const { conversationId } = data;
                const userId = socket.handshake.auth?.userId;


                // Kiểm tra xem user có trong group không
                const member = await prisma.conversationMember.findFirst({
                    where: {
                        conversationId: parseInt(conversationId),
                        userId: userId,
                        leftAt: null
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true
                            }
                        }
                    }
                });

                if (!member) {
                    socket.emit('chat:error', {
                        message: 'Bạn không có trong nhóm này'
                    });
                    return;
                }

                // Cập nhật leftAt để đánh dấu member đã rời
                await prisma.conversationMember.update({
                    where: {
                        conversationId_userId: {
                            conversationId: parseInt(conversationId),
                            userId: userId
                        }
                    },
                    data: {
                        leftAt: new Date()
                    }
                });

                // Tạo tin nhắn hệ thống
                const systemMessage = await createSystemMessage(conversationId, 'MEMBER_LEFT', {
                    userName: member.user.fullName || member.user.username
                });

                // Emit tin nhắn hệ thống cho tất cả thành viên
                io.to(`conversation_${conversationId}`).emit('chat:new_message', {
                    message: systemMessage,
                    conversationId: parseInt(conversationId)
                });

                // Rời khỏi phòng socket
                socket.leave(`conversation_${conversationId}`);

                // Emit conversation update để cập nhật sidebar
                io.to(`user_${userId}`).emit('chat:conversation_updated', {
                    conversationId: parseInt(conversationId),
                    action: 'delete'
                });

                

            } catch (error) {
                console.error('Error leaving group:', error);
                socket.emit('chat:error', {
                    message: 'Có lỗi xảy ra khi rời nhóm'
                });
            }
        });

        // Handle add members to group
        socket.on('chat:add_members', async (data) => {
            try {
                const { conversationId, memberIds } = data;
                const userId = socket.handshake.auth?.userId;

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

                // Kiểm tra xem các user đã có trong group chưa (kể cả đã rời nhóm)
                const existingMembers = await prisma.conversationMember.findMany({
                    where: {
                        conversationId: parseInt(conversationId),
                        userId: { in: memberIds.map(id => parseInt(id)) }
                    }
                });

                // Phân loại: active members và left members
                const activeMembers = existingMembers.filter(member => member.leftAt === null);
                const leftMembers = existingMembers.filter(member => member.leftAt !== null);
                
                const activeUserIds = activeMembers.map(member => member.userId);
                const leftUserIds = leftMembers.map(member => member.userId);
                const newMemberIds = memberIds.filter(id => !existingMembers.map(m => m.userId).includes(parseInt(id)));

                // Update lại leftAt = null cho user đã rời nhóm
                if (leftUserIds.length > 0) {
                    await prisma.conversationMember.updateMany({
                        where: {
                            conversationId: parseInt(conversationId),
                            userId: { in: leftUserIds.map(id => parseInt(id)) }
                        },
                        data: {
                            leftAt: null,
                            joinedAt: new Date()
                        }
                    });
                }

                if (newMemberIds.length === 0 && leftUserIds.length === 0) {
                    socket.emit('chat:error', {
                        message: 'Tất cả người được chọn đã có trong nhóm'
                    });
                    return;
                }

                // Thông báo nếu có một số người đã có trong nhóm
                if (activeUserIds.length > 0) {
                    socket.emit('chat:warning', {
                        message: `${activeUserIds.length} người đã có trong nhóm, chỉ thêm ${newMemberIds.length + leftUserIds.length} người mới`
                    });
                }

                // Thêm thành viên mới vào group
                const newMembers = await prisma.conversationMember.createMany({
                    data: newMemberIds.map(memberId => ({
                        conversationId: parseInt(conversationId),
                        userId: parseInt(memberId),
                        role: 'MEMBER',
                        joinedAt: new Date()
                    }))
                });

                // Lấy thông tin chi tiết của các thành viên mới (bao gồm cả rejoin)
                const allAddedMemberIds = [...newMemberIds, ...leftUserIds];
                const addedMembers = await prisma.conversationMember.findMany({
                    where: {
                        conversationId: parseInt(conversationId),
                        userId: { in: allAddedMemberIds.map(id => parseInt(id)) },
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

                // Lấy thông tin người thêm thành viên
                const addedByUser = await prisma.user.findUnique({
                    where: { id: userId },
                    select: {
                        id: true,
                        username: true,
                        fullName: true
                    }
                });

                // Tạo tin nhắn hệ thống cho từng thành viên được thêm
                for (const member of addedMembers) {
                    const systemMessage = await createSystemMessage(conversationId, 'MEMBER_ADDED', {
                        addedBy: addedByUser.fullName || addedByUser.username,
                        memberName: member.user.fullName || member.user.username
                    });

                    // Emit tin nhắn hệ thống cho tất cả thành viên
                    io.to(`conversation_${conversationId}`).emit('chat:new_message', {
                        message: systemMessage,
                        conversationId: parseInt(conversationId)
                    });
                }

                await emitConversationUpdate(io, conversationId, 'update');

                

            } catch (error) {
                console.error('Error adding members:', error);
                socket.emit('chat:error', {
                    message: 'Có lỗi xảy ra khi thêm thành viên'
                });
            }
        });

        socket.on('chat:remove_member', async (data) => {
            try {
                const { conversationId, userId: memberIdToRemove } = data;
                const currentUserId = socket.handshake.auth?.userId;
                if (!conversationId || !memberIdToRemove) return;
                // Lấy thông tin member thực hiện thao tác
                const currentMember = await prisma.conversationMember.findFirst({
                  where: {
                    conversationId: parseInt(conversationId),
                    userId: currentUserId,
                    leftAt: null
                  },
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        fullName: true
                      }
                    }
                  }
                });
                if (!currentMember || currentMember.role !== 'ADMIN') {
                  return socket.emit('chat:error', { message: 'Bạn không có quyền xóa thành viên này' });
                }
                if (parseInt(memberIdToRemove) === currentUserId) {
                  return socket.emit('chat:error', { message: 'Không thể tự xóa chính mình' });
                }
                // Tìm member bị xóa
                const member = await prisma.conversationMember.findFirst({
                  where: {
                    conversationId: parseInt(conversationId),
                    userId: parseInt(memberIdToRemove),
                    leftAt: null
                  },
                  include: {
                    user: true
                  }
                });
                if (!member) {
                  return socket.emit('chat:error', { message: 'Thành viên không tồn tại hoặc đã rời nhóm' });
                }
                await prisma.conversationMember.update({
                  where: {
                    conversationId_userId: {
                      conversationId: parseInt(conversationId),
                      userId: parseInt(memberIdToRemove),
                    }
                  },
                  data: { leftAt: new Date() }
                });
                // System message
                const systemMessage = await createSystemMessage(conversationId, 'MEMBER_KICKED', {
                  memberName: member.user.fullName || member.user.username,
                  kickedByName: currentMember.user.fullName || currentMember.user.username
                });
                io.to(`conversation_${conversationId}`).emit('chat:new_message', {
                  message: systemMessage,
                  conversationId: parseInt(conversationId)
                });
                await emitConversationUpdate(io, conversationId, 'update');
                
                io.to(`user_${memberIdToRemove}`).emit('chat:conversation_updated', {
                    conversationId: parseInt(conversationId),
                    action: 'delete'
                });
              } catch (err) {
                socket.emit('chat:error', { message: 'Không thể xóa thành viên nhóm' });
              }
        });
    });
};

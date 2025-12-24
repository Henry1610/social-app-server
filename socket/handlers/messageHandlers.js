import prisma from '../../utils/prisma.js';
import { createMessageWithStates } from '../../services/messageService.js';
import { checkConversationAccess } from '../../services/conversationService.js';
import { getConversationMembers, emitConversationUpdate } from './helpers/chatHelpers.js';
import { createOrUpdateReactionService } from '../../services/reactionService.js';
import * as messageRepository from '../../repositories/messageRepository.js';

// Xử lý các event liên quan đến message
export const registerMessageHandlers = (socket, userId, io) => {
    // Send message
    socket.on('chat:send_message', async (data) => {
        try {
            const { conversationId, content, type = 'TEXT', replyToId, mediaUrl, mediaType, filename, size } = data;

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
                mediaUrl,
                mediaType,
                filename,
                size
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
                let notificationMessage = '';
                if (message.content) {
                    notificationMessage = message.content;
                } else if (message.mediaUrl) {
                    switch (message.type) {
                        case 'IMAGE':
                            notificationMessage = 'đã gửi hình ảnh';
                            break;
                        case 'VIDEO':
                            notificationMessage = 'đã gửi video';
                            break;
                        default:
                            notificationMessage = 'đã gửi tin nhắn';
                    }
                } else {
                    notificationMessage = 'đã gửi tin nhắn';
                }

                io.to(`user_${member.userId}`).emit('notification', {
                    type: 'MESSAGE',
                    from: {
                        username: message.sender.username,
                        avatarUrl: message.sender.avatarUrl
                    },
                    message: notificationMessage,
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

    // React to message
    socket.on('chat:react_message', async (data) => {
        try {
            console.log('Received chat:react_message event with data:', data);
            const { messageId, conversationId, reactionType = 'LIKE' } = data;

            if (!messageId || !conversationId) {
                socket.emit('chat:error', { message: 'messageId và conversationId là bắt buộc' });
                return;
            }

            // 1. Kiểm tra quyền (user có trong conversation không)
            const hasAccess = await checkConversationAccess(userId, conversationId);
            if (!hasAccess) {
                socket.emit('chat:error', { message: 'Không có quyền react tin nhắn trong cuộc trò chuyện này' });
                return;
            }

            // 2. Kiểm tra message tồn tại và thuộc conversation
            const message = await messageRepository.findMessageById(parseInt(messageId), {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        avatarUrl: true
                    }
                }
            });

            if (!message || message.deletedAt || message.isRecalled) {
                socket.emit('chat:error', { message: 'Tin nhắn không tồn tại hoặc đã bị xóa' });
                return;
            }

            if (message.conversationId !== parseInt(conversationId)) {
                socket.emit('chat:error', { message: 'Tin nhắn không thuộc cuộc trò chuyện này' });
                return;
            }

            // 3. Tạo/update reaction trong DB (qua service)
            const result = await createOrUpdateReactionService({
                userId,
                targetId: parseInt(messageId),
                targetType: 'MESSAGE',
                type: reactionType
            });

            if (!result.success) {
                socket.emit('chat:error', { message: result.message || 'Có lỗi xảy ra khi react tin nhắn' });
                return;
            }

            // 4. Broadcast realtime vào room conversation
            io.to(`conversation_${conversationId}`).emit('chat:message_reaction_updated', {
                messageId: parseInt(messageId),
                conversationId: parseInt(conversationId),
                reaction: result.reaction,
                userId,
                action: result.reaction ? 'added' : 'removed' // 'added' hoặc 'removed'
            });

        } catch (error) {
            console.error('Error reacting to message:', error);
            socket.emit('chat:error', { message: 'Có lỗi xảy ra khi react tin nhắn' });
        }
    });
};


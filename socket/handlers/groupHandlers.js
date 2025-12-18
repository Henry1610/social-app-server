import prisma from '../../utils/prisma.js';
import { createSystemMessage } from '../../services/systemMessageService.js';
import { emitConversationUpdate } from './helpers/chatHelpers.js';

// Xử lý các event liên quan đến group
export const registerGroupHandlers = (socket, userId, io) => {
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

    // Handle remove member from group
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
};


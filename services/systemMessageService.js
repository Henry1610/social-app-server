import prisma from '../utils/prisma.js';

export const createSystemMessage = async (conversationId, type, data) => {
    try {
        const message = await prisma.message.create({
            data: {
                conversationId: parseInt(conversationId),
                senderId: null,
                type: 'TEXT',
                content: generateSystemMessageContent(type, data),
                isSystem: true,
                createdAt: new Date()
            }
        });
        
        return message;
    } catch (error) {
        console.error('Error creating system message:', error);
        throw error;
    }
};

const generateSystemMessageContent = (type, data) => {
    switch (type) {
        case 'MEMBER_ADDED':
            return `${data.addedBy} đã thêm ${data.memberName} vào nhóm`;
        
        case 'MEMBER_LEFT':
            return `${data.userName} đã rời khỏi nhóm`;
        
        case 'GROUP_CREATED':
            return `${data.createdBy} đã tạo nhóm "${data.groupName}"`;
        
        case 'MEMBER_KICKED':
            if (data.kickedByName)
                return `${data.memberName} đã bị ${data.kickedByName} xóa khỏi nhóm`;
            return `${data.memberName} đã bị admin xóa khỏi nhóm`;
        
        default:
            return 'Hệ thống đã thực hiện một thay đổi';
    }
};


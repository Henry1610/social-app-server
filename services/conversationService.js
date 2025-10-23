import prisma from "../utils/prisma.js";

export const checkConversationAccess = async (userId, conversationId) => {
  return await prisma.conversationMember.findFirst({
    where: {
      conversationId: parseInt(conversationId),
      userId,
      leftAt: null,
    },
  });
};

export const checkAdminPermission = async (userId, conversationId) => {
  return await prisma.conversationMember.findFirst({
    where: {
      conversationId: parseInt(conversationId),
      userId,
      role: 'ADMIN',
      leftAt: null,
    },
  });
};

export const getConversationWithAccess = async (userId, conversationId, include = {}) => {
  return await prisma.conversation.findFirst({
    where: {
      id: parseInt(conversationId),
      members: {
        some: {
          userId,
          leftAt: null,
        },
      },
    },
    include,
  });
};

export const findOrCreateDirectConversation = async (userId, participantId) => {
  // Kiểm tra conversation đã tồn tại chưa
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      members: {
        every: {
          userId: {
            in: [userId, participantId],
          },
          leftAt: null,
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  if (existingConversation) {
    return existingConversation;
  }

  // Tạo conversation mới
  return await prisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdBy: userId,
      members: {
        create: [
          {
            userId,
            role: 'MEMBER',
          },
          {
            userId: participantId,
            role: 'MEMBER',
          },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
};

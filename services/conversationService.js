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
      type: "DIRECT",

      AND: [
        // 1. conversation phải có user hiện tại
        {
          members: {
            some: {
              userId: userId,
              leftAt: null,
            }
          },
        },

        // 2. conversation phải có participant
        {
          members: {
            some: {
              userId: participantId,
              leftAt: null,
            },
          },
        },

        // 3. mọi member đều phải thuộc 2 người này & chưa rời
        {
          members: {
            every: {
              userId: { in: [userId, participantId] },
              leftAt: null,
            },
          },
        }
      ],
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

/**
 * Lấy danh sách conversations của user với pagination
 * @param {number} userId - ID của user
 * @param {Object} options - Các options
 * @param {number} options.page - Số trang (mặc định: 1)
 * @param {number} options.limit - Số lượng items mỗi trang (mặc định: 20)
 * @returns {Promise<{conversations: Array, totalCount: number}>}
 */
export const fetchConversations = async (userId, { page = 1, limit = 20 } = {}) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      members: {
        some: {
          userId: userId,
          leftAt: null,
        },
      },
      messages: {
        some: {},
      },
    },
    include: {
      members: {
        where: {
          leftAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              isOnline: true,
              lastSeen: true,
              privacySettings: {
                select: {
                  showOnlineStatus: true,
                },
              },
            },
          },
        },
      },
      messages: {
        take: 1,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      },
      _count: {
        select: {
          messages: {
            where: {
              senderId: {
                not: userId,
              },
              states: {
                some: {
                  userId: userId,
                  status: {
                    in: ['SENT', 'DELIVERED']
                  },
                },
              },
              deletedAt: null,
            },
          },
        },
      },
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
    take: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit),
  });

  const totalCount = await prisma.conversation.count({
    where: {
      members: {
        some: {
          userId: userId,
          leftAt: null,
        },
      },
      messages: {
        some: {},
      },
    },
  });

  return {
    conversations,
    totalCount
  };
};

/**
 * Tạo GROUP conversation mới
 * @param {Object} options - Các options
 * @param {number} options.createdBy - ID của user tạo nhóm
 * @param {string} options.name - Tên nhóm
 * @param {string} options.avatarUrl - Avatar nhóm
 * @param {Array<number>} options.participantIds - Danh sách ID của participants
 * @returns {Promise<Object>} Conversation object đã được tạo
 */
export const createGroupConversation = async ({ createdBy, name, avatarUrl, participantIds }) => {
  return await prisma.conversation.create({
    data: {
      type: 'GROUP',
      name,
      avatarUrl,
      createdBy,
      members: {
        create: [
          {
            userId: createdBy,
            role: 'ADMIN',
          },
          ...participantIds.map((participantId) => ({
            userId: participantId,
            role: 'MEMBER',
          })),
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
              isOnline: true,
              lastSeen: true,
            },
          },
        },
      },
    },
  });
};

/**
 * Lấy danh sách members của conversation
 * @param {number} conversationId - ID của conversation
 * @returns {Promise<Array>} Danh sách members
 */
export const getConversationMembersList = async (conversationId) => {
  return await prisma.conversationMember.findMany({
    where: {
      conversationId: parseInt(conversationId),
      leftAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
          privacySettings: {
            select: {
              whoCanMessage: true,
              showOnlineStatus: true,
            },
          },
        },
      },
    },
  });
};

/**
 * Thêm member vào conversation
 * @param {Object} options - Các options
 * @param {number} options.conversationId - ID của conversation
 * @param {number} options.userId - ID của user cần thêm
 * @param {string} options.role - Role của member (mặc định: 'MEMBER')
 * @returns {Promise<Object>} Member record đã được tạo
 */
export const addConversationMember = async ({ conversationId, userId, role = 'MEMBER' }) => {
  return await prisma.conversationMember.create({
    data: {
      conversationId: parseInt(conversationId),
      userId,
      role,
    },
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
  });
};

/**
 * Xóa member khỏi conversation (soft delete - set leftAt)
 * @param {Object} options - Các options
 * @param {number} options.conversationId - ID của conversation
 * @param {number} options.userId - ID của user cần xóa
 * @returns {Promise<void>}
 */
export const removeConversationMember = async ({ conversationId, userId }) => {
  await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: parseInt(conversationId),
        userId: parseInt(userId),
      },
    },
    data: {
      leftAt: new Date(),
    },
  });
};
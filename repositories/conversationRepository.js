import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Conversation operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Conversation Operations ============

/**
 * Tìm conversation theo ID với access check (user phải là member)
 * @param {number} conversationId - ID của conversation
 * @param {number} userId - ID của user
 * @param {Object} include - Include options
 * @returns {Promise<Object|null>} Conversation object hoặc null
 */
export const findConversationWithAccess = async (userId, conversationId, include = {}) => {
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
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Tìm DIRECT conversation giữa 2 users (để check đã tồn tại chưa)
 * @param {number} userId - ID của user 1
 * @param {number} participantId - ID của user 2
 * @param {Object} include - Include options
 * @returns {Promise<Object|null>} Conversation object hoặc null
 */
export const findDirectConversationByMembers = async (userId, participantId, include = {}) => {
  return await prisma.conversation.findFirst({
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
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Tạo conversation mới
 * @param {Object} data - Conversation data
 * @param {string} data.type - Type của conversation (DIRECT, GROUP)
 * @param {number} data.createdBy - ID của user tạo
 * @param {string} data.name - Tên nhóm (optional, cho GROUP)
 * @param {string} data.avatarUrl - Avatar nhóm (optional, cho GROUP)
 * @param {Array} data.members - Array of member data: [{ userId, role }]
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Created conversation
 */
export const createConversation = async (data, include = {}) => {
  return await prisma.conversation.create({
    data: {
      type: data.type,
      createdBy: data.createdBy,
      ...(data.name && { name: data.name }),
      ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      members: {
        create: data.members.map(member => ({
          userId: member.userId,
          role: member.role,
        }))
      },
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Lấy danh sách conversations của user với pagination và complex includes
 * @param {number} userId - ID của user
 * @param {Object} options - Options
 * @param {number} options.page - Số trang
 * @param {number} options.limit - Số lượng items mỗi trang
 * @param {Object} options.include - Include options
 * @returns {Promise<Array>} Danh sách conversations
 */
export const findConversationsByUserId = async (userId, options = {}) => {
  const { page = 1, limit = 20, include = {} } = options;
  
  return await prisma.conversation.findMany({
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
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: {
      lastMessageAt: 'desc',
    },
    take: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit),
  });
};

/**
 * Đếm số conversations của user
 * @param {number} userId - ID của user
 * @returns {Promise<number>} Tổng số conversations
 */
export const countConversationsByUserId = async (userId) => {
  return await prisma.conversation.count({
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
};

// ============ ConversationMember Operations ============

/**
 * Tìm conversation member theo conversationId và userId
 * @param {number} conversationId - ID của conversation
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} ConversationMember object hoặc null
 */
export const findConversationMember = async (conversationId, userId) => {
  return await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: parseInt(conversationId),
        userId: userId,
      },
    },
  });
};

/**
 * Tìm conversation member với access check (phải chưa left)
 * @param {number} conversationId - ID của conversation
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} ConversationMember object hoặc null
 */
export const findConversationMemberByAccess = async (conversationId, userId) => {
  return await prisma.conversationMember.findFirst({
    where: {
      conversationId: parseInt(conversationId),
      userId,
      leftAt: null,
    },
  });
};

/**
 * Tìm conversation member với admin permission
 * @param {number} conversationId - ID của conversation
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} ConversationMember object hoặc null
 */
export const findConversationMemberByAdmin = async (conversationId, userId) => {
  return await prisma.conversationMember.findFirst({
    where: {
      conversationId: parseInt(conversationId),
      userId,
      role: 'ADMIN',
      leftAt: null,
    },
  });
};

/**
 * Lấy danh sách members của conversation
 * @param {number} conversationId - ID của conversation
 * @param {Object} include - Include options
 * @returns {Promise<Array>} Danh sách members
 */
export const findConversationMembersByConversationId = async (conversationId, include = {}) => {
  return await prisma.conversationMember.findMany({
    where: {
      conversationId: parseInt(conversationId),
      leftAt: null,
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Tạo conversation member mới
 * @param {Object} data - Member data
 * @param {number} data.conversationId - ID của conversation
 * @param {number} data.userId - ID của user
 * @param {string} data.role - Role của member (MEMBER, ADMIN)
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Created conversation member
 */
export const createConversationMember = async (data, include = {}) => {
  return await prisma.conversationMember.create({
    data: {
      conversationId: parseInt(data.conversationId),
      userId: data.userId,
      role: data.role || 'MEMBER',
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Cập nhật conversation member (soft delete - set leftAt)
 * @param {number} conversationId - ID của conversation
 * @param {number} userId - ID của user
 * @param {Object} data - Update data (e.g., { leftAt: new Date() })
 * @returns {Promise<Object>} Updated conversation member
 */
export const updateConversationMember = async (conversationId, userId, data) => {
  return await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: parseInt(conversationId),
        userId: parseInt(userId),
      },
    },
    data,
  });
};


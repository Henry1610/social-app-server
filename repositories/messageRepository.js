import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Message operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Message Operations ============

/**
 * Tìm message theo ID
 * @param {number} messageId - ID của message
 * @param {Object} include - Include options
 * @returns {Promise<Object|null>} Message record hoặc null
 */
export const findMessageById = async (messageId, include = {}) => {
  return await prisma.message.findUnique({
    where: { id: parseInt(messageId) },
    ...(Object.keys(include).length > 0 && { include })
  });
};

/**
 * Tìm message theo ID với include sender
 * @param {number} messageId - ID của message
 * @returns {Promise<Object|null>} Message record với sender hoặc null
 */
export const findMessageByIdWithSender = async (messageId) => {
  return await prisma.message.findUnique({
    where: { id: parseInt(messageId) },
    include: { sender: true }
  });
};

/**
 * Tìm messages theo conversationId với include và pagination
 * @param {number} conversationId - ID của conversation
 * @param {Object} options - Options (include, where, orderBy, take, skip)
 * @returns {Promise<Array>} Danh sách messages
 */
export const findMessagesByConversationId = async (conversationId, options = {}) => {
  const {
    include = {},
    where = {},
    orderBy = { createdAt: 'asc' },
    take,
    skip
  } = options;

  return await prisma.message.findMany({
    where: {
      conversationId: parseInt(conversationId),
      deletedAt: null,
      ...where
    },
    ...(Object.keys(include).length > 0 && { include }),
    orderBy,
    ...(take && { take }),
    ...(skip !== undefined && { skip })
  });
};

/**
 * Đếm số lượng messages trong conversation
 * @param {number} conversationId - ID của conversation
 * @param {Object} where - Where conditions
 * @returns {Promise<number>} Số lượng messages
 */
export const countMessagesByConversationId = async (conversationId, where = {}) => {
  return await prisma.message.count({
    where: {
      conversationId: parseInt(conversationId),
      deletedAt: null,
      ...where
    }
  });
};

/**
 * Tạo message mới
 * @param {Object} data - Message data
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Message đã được tạo
 */
export const createMessage = async (data, include = {}) => {
  return await prisma.message.create({
    data: {
      conversationId: parseInt(data.conversationId),
      senderId: data.senderId,
      type: data.type || 'TEXT',
      content: data.content,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      filename: data.filename,
      fileSize: data.fileSize ? parseInt(data.fileSize) : null,
      replyToId: data.replyToId ? parseInt(data.replyToId) : null,
      isSystem: data.isSystem || false,
      ...(data.createdAt && { createdAt: data.createdAt }),
    },
    ...(Object.keys(include).length > 0 && { include })
  });
};

/**
 * Cập nhật message
 * @param {number} messageId - ID của message
 * @param {Object} data - Data to update
 * @returns {Promise<Object>} Updated message
 */
export const updateMessage = async (messageId, data) => {
  return await prisma.message.update({
    where: { id: parseInt(messageId) },
    data
  });
};

/**
 * Soft delete message (cập nhật deletedAt)
 * @param {number} messageId - ID của message
 * @returns {Promise<Object>} Updated message
 */
export const softDeleteMessage = async (messageId) => {
  return await prisma.message.update({
    where: { id: parseInt(messageId) },
    data: { deletedAt: new Date() }
  });
};

// ============ MessageState Operations ============

/**
 * Lấy message states theo messageId
 * @param {number} messageId - ID của message
 * @param {Object} include - Include options
 * @returns {Promise<Array>} Danh sách message states
 */
export const findMessageStatesByMessageId = async (messageId, include = {}) => {
  return await prisma.messageState.findMany({
    where: { messageId: parseInt(messageId) },
    ...(Object.keys(include).length > 0 && { include })
  });
};

/**
 * Tạo nhiều message states
 * @param {Array} data - Array of message state data
 * @returns {Promise<Object>} Prisma createMany result
 */
export const createMessageStates = async (data) => {
  return await prisma.messageState.createMany({
    data
  });
};

/**
 * Upsert message state
 * @param {number} messageId - ID của message
 * @param {number} userId - ID của user
 * @param {Object} data - Data to upsert
 * @returns {Promise<Object>} Upserted message state
 */
export const upsertMessageState = async (messageId, userId, data) => {
  return await prisma.messageState.upsert({
    where: {
      messageId_userId: {
        messageId: parseInt(messageId),
        userId: userId
      }
    },
    update: data.update || {},
    create: {
      messageId: parseInt(messageId),
      userId: userId,
      ...(data.create || {})
    }
  });
};

// ============ MessageEditHistory Operations ============

/**
 * Lấy edit history của message
 * @param {number} messageId - ID của message
 * @param {Object} include - Include options
 * @param {Object} orderBy - Order by options
 * @returns {Promise<Array>} Danh sách edit history
 */
export const findMessageEditHistoryByMessageId = async (messageId, include = {}, orderBy = { editedAt: 'asc' }) => {
  return await prisma.messageEditHistory.findMany({
    where: { messageId: parseInt(messageId) },
    ...(Object.keys(include).length > 0 && { include }),
    orderBy
  });
};

// ============ PinnedMessage Operations ============

/**
 * Tìm pinned message theo conversationId và messageId
 * @param {number} conversationId - ID của conversation
 * @param {number} messageId - ID của message
 * @returns {Promise<Object|null>} PinnedMessage record hoặc null
 */
export const findPinnedMessage = async (conversationId, messageId) => {
  return await prisma.pinnedMessage.findUnique({
    where: {
      conversationId_messageId: {
        conversationId: parseInt(conversationId),
        messageId: parseInt(messageId)
      }
    }
  });
};

/**
 * Tạo pinned message
 * @param {Object} data - PinnedMessage data
 * @returns {Promise<Object>} PinnedMessage đã được tạo
 */
export const createPinnedMessage = async (data) => {
  return await prisma.pinnedMessage.create({
    data: {
      conversationId: parseInt(data.conversationId),
      messageId: parseInt(data.messageId),
      pinnedById: data.pinnedById
    }
  });
};

/**
 * Xóa pinned message
 * @param {number} conversationId - ID của conversation
 * @param {number} messageId - ID của message
 * @returns {Promise<Object>} Deleted pinned message
 */
export const deletePinnedMessage = async (conversationId, messageId) => {
  return await prisma.pinnedMessage.delete({
    where: {
      conversationId_messageId: {
        conversationId: parseInt(conversationId),
        messageId: parseInt(messageId)
      }
    }
  });
};

/**
 * Lấy danh sách pinned messages theo conversationId
 * @param {number} conversationId - ID của conversation
 * @param {Object} include - Include options
 * @param {Object} orderBy - Order by options
 * @returns {Promise<Array>} Danh sách pinned messages
 */
export const findPinnedMessagesByConversationId = async (conversationId, include = {}, orderBy = { pinnedAt: 'desc' }) => {
  return await prisma.pinnedMessage.findMany({
    where: { conversationId: parseInt(conversationId) },
    ...(Object.keys(include).length > 0 && { include }),
    orderBy
  });
};

// ============ Conversation Operations ============

/**
 * Cập nhật lastMessageAt của conversation
 * @param {number} conversationId - ID của conversation
 * @param {Date} lastMessageAt - Thời gian tin nhắn cuối
 * @returns {Promise<Object>} Updated conversation
 */
export const updateConversationLastMessageAt = async (conversationId, lastMessageAt) => {
  return await prisma.conversation.update({
    where: { id: parseInt(conversationId) },
    data: { lastMessageAt }
  });
};

/**
 * Tìm conversation member
 * @param {Object} where - Where conditions
 * @returns {Promise<Object|null>} ConversationMember record hoặc null
 */
export const findConversationMember = async (where) => {
  return await prisma.conversationMember.findFirst({
    where: {
      ...where,
      conversationId: where.conversationId ? parseInt(where.conversationId) : undefined,
      userId: where.userId ? parseInt(where.userId) : undefined
    }
  });
};

/**
 * Lấy danh sách conversation members
 * @param {Object} where - Where conditions
 * @param {Object} include - Include options
 * @returns {Promise<Array>} Danh sách conversation members
 */
export const findConversationMembers = async (where, include = {}) => {
  return await prisma.conversationMember.findMany({
    where: {
      ...where,
      conversationId: where.conversationId ? parseInt(where.conversationId) : undefined
    },
    ...(Object.keys(include).length > 0 && { include })
  });
};


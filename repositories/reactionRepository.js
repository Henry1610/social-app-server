import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Reaction operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Reaction Operations ============

/**
 * Tìm reaction theo userId, targetType, targetId (unique constraint)
 * @param {number} userId - ID của user
 * @param {string} targetType - Type của target (POST, COMMENT, REPOST, etc.)
 * @param {number} targetId - ID của target
 * @returns {Promise<Object|null>} Reaction record hoặc null
 */
export const findReactionByUserAndTarget = async (userId, targetType, targetId) => {
  return await prisma.reaction.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: Number(userId),
        targetType: targetType.toUpperCase(),
        targetId: Number(targetId),
      }
    }
  });
};

/**
 * Tạo reaction mới
 * @param {Object} data - Reaction data
 * @param {number} data.userId - ID của user
 * @param {number} data.targetId - ID của target
 * @param {string} data.targetType - Type của target
 * @param {string} data.reactionType - Type của reaction (LIKE, LOVE, etc.)
 * @param {Object} include - Include options (e.g., { user: { select: {...} } })
 * @returns {Promise<Object>} Created reaction record
 */
export const createReaction = async (data, include = {}) => {
  return await prisma.reaction.create({
    data: {
      userId: Number(data.userId),
      targetId: Number(data.targetId),
      targetType: data.targetType.toUpperCase(),
      reactionType: data.reactionType.toUpperCase(),
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Cập nhật reaction type
 * @param {number} userId - ID của user
 * @param {string} targetType - Type của target
 * @param {number} targetId - ID của target
 * @param {string} reactionType - New reaction type
 * @returns {Promise<Object>} Updated reaction record
 */
export const updateReaction = async (userId, targetType, targetId, reactionType) => {
  return await prisma.reaction.update({
    where: {
      userId_targetType_targetId: {
        userId: Number(userId),
        targetType: targetType.toUpperCase(),
        targetId: Number(targetId),
      }
    },
    data: { reactionType: reactionType.toUpperCase() },
  });
};

/**
 * Xóa reaction
 * @param {number} userId - ID của user
 * @param {string} targetType - Type của target
 * @param {number} targetId - ID của target
 * @returns {Promise<Object>} Deleted reaction record
 */
export const deleteReaction = async (userId, targetType, targetId) => {
  return await prisma.reaction.delete({
    where: {
      userId_targetType_targetId: {
        userId: Number(userId),
        targetType: targetType.toUpperCase(),
        targetId: Number(targetId),
      }
    }
  });
};

/**
 * Lấy danh sách reactions của một target
 * @param {number} targetId - ID của target
 * @param {string} targetType - Type của target
 * @param {Object} include - Include options (e.g., { user: { select: {...} } })
 * @param {Object} options - Options (orderBy)
 * @returns {Promise<Array>} Danh sách reactions
 */
export const findReactionsByTarget = async (targetId, targetType, include = {}, options = {}) => {
  const { orderBy } = options;
  
  return await prisma.reaction.findMany({
    where: {
      targetId: Number(targetId),
      targetType: targetType.toUpperCase()
    },
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: orderBy || { createdAt: 'desc' }
  });
};

/**
 * Lấy thống kê reactions theo type (group by reactionType)
 * @param {number} targetId - ID của target
 * @param {string} targetType - Type của target
 * @returns {Promise<Array>} Array of stats: [{ reactionType, _count: { id } }]
 */
export const groupReactionsByType = async (targetId, targetType) => {
  return await prisma.reaction.groupBy({
    by: ['reactionType'],
    where: {
      targetId: Number(targetId),
      targetType: targetType.toUpperCase()
    },
    _count: {
      id: true
    }
  });
};


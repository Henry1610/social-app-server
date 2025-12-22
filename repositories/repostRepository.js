import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Repost operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Repost Operations ============

/**
 * Tìm repost theo userId và postId
 * @param {number} userId - ID của user
 * @param {number} postId - ID của post
 * @returns {Promise<Object|null>} Repost record hoặc null
 */
export const findRepostByUserAndPost = async (userId, postId) => {
  return await prisma.repost.findFirst({
    where: { userId, postId: Number(postId), deletedAt: null },
  });
};

/**
 * Tạo hoặc phục hồi repost (upsert)
 * @param {number} userId - ID của user
 * @param {number} postId - ID của post
 * @param {string} content - Nội dung repost
 * @returns {Promise<Object>} Repost record
 */
export const upsertRepost = async (userId, postId, content = '') => {
  return await prisma.repost.upsert({
    where: {
      userId_postId: {
        userId,
        postId: Number(postId)
      }
    },
    update: { deletedAt: null, content, createdAt: new Date() },
    create: {
      userId,
      postId: Number(postId),
      content,
      createdAt: new Date(),
    },
  });
};

/**
 * Xóa mềm repost
 * @param {number} repostId - ID của repost
 * @returns {Promise<Object>} Updated repost record
 */
export const softDeleteRepost = async (repostId) => {
  return await prisma.repost.update({
    where: { id: repostId },
    data: { deletedAt: new Date() },
  });
};

/**
 * Đếm số reposts của một post (chưa xóa)
 * @param {number} postId - ID của post
 * @returns {Promise<number>} Số lượng reposts
 */
export const countRepostsByPostId = async (postId) => {
  return await prisma.repost.count({
    where: { postId: Number(postId), deletedAt: null },
  });
};

/**
 * Tìm repost theo ID
 * @param {number} repostId - ID của repost
 * @returns {Promise<Object|null>} Repost record hoặc null
 */
export const findRepostById = async (repostId) => {
  return await prisma.repost.findUnique({
    where: { id: repostId },
  });
};

/**
 * Lấy danh sách reposts của một user
 * @param {number} userId - ID của user
 * @param {Object} options - Options cho query
 * @returns {Promise<Array>} Danh sách reposts
 */
export const getRepostsByUserId = async (userId, options = {}) => {
  const { includePost = true, includeUser = true } = options;
  
  return await prisma.repost.findMany({
    where: { 
      userId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      ...(includeUser && {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        }
      }),
      ...(includePost && {
        post: {
          include: {
            user: {
              select: { id: true, username: true, fullName: true, avatarUrl: true }
            },
            media: true,
            _count: {
              select: { comments: true, reposts: true, savedPosts: true }
            }
          }
        }
      }),
      _count: {
        select: {
          comments: true
        }
      }
    }
  });
};

// ============ PostView Operations (cho Repost) ============

/**
 * Tạo hoặc cập nhật post view cho repost
 * @param {number} repostId - ID của repost
 * @param {number} userId - ID của user
 * @returns {Promise<Object>} PostView record
 */
export const upsertRepostView = async (repostId, userId) => {
  return await prisma.postView.upsert({
    where: {
      repostId_userId: {
        repostId: repostId,
        userId: userId
      }
    },
    update: {
      viewedAt: new Date()
    },
    create: {
      repostId: repostId,
      userId: userId,
      viewedAt: new Date()
    }
  });
};


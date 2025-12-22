import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Post operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Post Operations ============

/**
 * Tìm post theo ID
 * @param {number} postId - ID của post
 * @param {Object} select - Select fields
 * @returns {Promise<Object|null>} Post record hoặc null
 */
export const findPostById = async (postId, select = {}) => {
  return await prisma.post.findFirst({
    where: {
      id: postId,
      deletedAt: null
    },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tìm post theo ID với include
 * @param {number} postId - ID của post
 * @param {Object} include - Include options
 * @returns {Promise<Object|null>} Post record hoặc null
 */
export const findPostByIdWithInclude = async (postId, include = {}) => {
  return await prisma.post.findFirst({
    where: {
      id: postId,
      deletedAt: null
    },
    include
  });
};


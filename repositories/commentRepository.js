import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Comment operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Comment Operations ============

/**
 * Tìm comment theo ID
 * @param {number} commentId - ID của comment
 * @param {Object} options - Options với include hoặc select
 * @returns {Promise<Object|null>} Comment record hoặc null
 */
export const findCommentById = async (commentId, options = {}) => {
  const query = {
    where: { id: commentId }
  };

  if (options.include) {
    query.include = options.include;
  } else if (options.select) {
    query.select = options.select;
  } else if (Object.keys(options).length > 0 && !options.include && !options.select) {
    // Nếu options là object nhưng không có include/select, coi như là include
    query.include = options;
  }

  return await prisma.comment.findUnique(query);
};

/**
 * Tìm comment theo ID với điều kiện
 * @param {number} commentId - ID của comment
 * @param {Object} where - Where conditions
 * @param {Object} select - Select fields
 * @returns {Promise<Object|null>} Comment record hoặc null
 */
export const findCommentByIdWithWhere = async (commentId, where = {}, select = {}) => {
  return await prisma.comment.findFirst({
    where: {
      id: commentId,
      ...where
    },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tạo comment mới
 * @param {Object} data - Comment data
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Created comment
 */
export const createComment = async (data, include = {}) => {
  return await prisma.comment.create({
    data,
    include
  });
};

/**
 * Xóa mềm comment
 * @param {number} commentId - ID của comment
 * @returns {Promise<Object>} Updated comment
 */
export const softDeleteComment = async (commentId) => {
  return await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() }
  });
};

/**
 * Lấy danh sách comments với pagination
 * @param {Object} options - Query options
 * @param {Object} options.where - Where clause
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.sortBy - Sort order ('desc' or 'asc')
 * @param {Object} options.include - Include options
 * @param {Object} options.countSelect - Count select options
 * @returns {Promise<{comments: Array, totalComments: number, totalPages: number}>}
 */
export const getCommentsWithPagination = async ({
  where,
  page = 1,
  limit = 20,
  sortBy = "desc",
  include = {},
  countSelect = {}
}) => {
  const skip = (page - 1) * limit;

  const [comments, totalComments] = await Promise.all([
    prisma.comment.findMany({
      where,
      include,
      orderBy: { createdAt: sortBy },
      skip,
      take: limit
    }),
    prisma.comment.count({ where })
  ]);

  const totalPages = Math.ceil(totalComments / limit);

  return {
    comments,
    totalComments,
    totalPages
  };
};

/**
 * Lấy danh sách replies với pagination
 * @param {Object} options - Query options
 * @param {number} options.parentId - Parent comment ID
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.sortBy - Sort order ('desc' or 'asc')
 * @param {Object} options.include - Include options
 * @returns {Promise<{replies: Array, totalReplies: number, totalPages: number}>}
 */
export const getRepliesWithPagination = async ({
  parentId,
  page = 1,
  limit = 20,
  sortBy = "desc",
  include = {}
}) => {
  const skip = (page - 1) * limit;

  const where = {
    parentId,
    deletedAt: null
  };

  const [replies, totalReplies] = await Promise.all([
    prisma.comment.findMany({
      where,
      include,
      orderBy: { createdAt: sortBy },
      skip,
      take: limit
    }),
    prisma.comment.count({ where })
  ]);

  const totalPages = Math.ceil(totalReplies / limit);

  return {
    replies,
    totalReplies,
    totalPages
  };
};

/**
 * Tính độ sâu của comment (số cấp nested)
 * @param {number} commentId - ID của comment
 * @param {number} maxDepth - Độ sâu tối đa để kiểm tra
 * @returns {Promise<number>} Độ sâu của comment
 */
export const calculateCommentDepth = async (commentId, maxDepth = 3) => {
  let depth = 1;
  let currentCommentId = commentId;

  while (depth < maxDepth) {
    const comment = await prisma.comment.findUnique({
      where: { id: currentCommentId },
      select: { parentId: true }
    });

    if (!comment || !comment.parentId) {
      break;
    }

    depth++;
    currentCommentId = comment.parentId;
  }

  return depth;
};


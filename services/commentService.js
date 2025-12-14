import prisma from "../utils/prisma.js";
import { isFollowing } from "./followService.js";

/**
 * Kiểm tra quyền comment dựa trên whoCanComment setting
 * @param {number} userId - ID của user đang cố comment
 * @param {object} post - Post object có userId và whoCanComment
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
export const checkCommentPermission = async (userId, post) => {
  const whoCanComment = post.whoCanComment || 'everyone';
  
  switch (whoCanComment) {
    case "everyone":
      return { allowed: true };
      
    case "followers":
      const isFollower = await isFollowing(userId, post.userId);
      if (!isFollower) {
        return { allowed: false, message: "Chỉ follower mới được comment" };
      }
      return { allowed: true };
      
    case "nobody":
      if (post.userId !== userId) {
        return { allowed: false, message: "Chỉ chủ post mới được comment" };
      }
      return { allowed: true };
      
    default:
      return { allowed: false, message: "Cấu hình quyền comment không hợp lệ" };
  }
};

/**
 * Lấy danh sách comments với pagination
 * @param {Object} options - Các options để config
 * @param {Object} options.where - Where clause cho Prisma query
 * @param {number} options.page - Số trang (mặc định: 1)
 * @param {number} options.limit - Số lượng items mỗi trang (mặc định: 20)
 * @param {string} options.sortBy - Sắp xếp ('desc' hoặc 'asc', mặc định: 'desc')
 * @param {boolean} options.includeMentions - Có bao gồm mentions trong _count không (mặc định: false)
 * @returns {Promise<{comments: Array, pagination: Object}>}
 */
export const fetchComments = async ({
  where,
  page = 1,
  limit = 20,
  sortBy = "desc",
  includeMentions = false,
}) => {
  const skip = (page - 1) * limit;

  // Tạo count select dựa trên includeMentions
  const countSelect = includeMentions 
    ? { replies: true, mentions: true }
    : { replies: true };

  const [comments, totalComments] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
        _count: {
          select: countSelect
        }
      },
      orderBy: { createdAt: sortBy },
      skip,
      take: limit
    }),

    prisma.comment.count({ where })
  ]);

  const totalPages = Math.ceil(totalComments / limit);

  return {
    comments,
    pagination: {
      currentPage: page,
      limit,
      totalComments,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }
  };
};

/**
 * Tạo comment mới cho post hoặc repost
 * @param {Object} options - Các options để config
 * @param {'post' | 'repost'} options.type - Loại entity (post hoặc repost)
 * @param {number} options.entityId - ID của post hoặc repost
 * @param {number} options.userId - ID của user đang comment
 * @param {string} options.content - Nội dung comment
 * @returns {Promise<Object>} Comment object đã được tạo với user và _count
 */
export const createComment = async ({ type, entityId, userId, content }) => {
  // Tạo data cho comment dựa trên type
  const commentData = {
    content,
    userId,
    ...(type === 'post' ? { postId: entityId } : { repostId: entityId })
  };

  // Tạo comment
  const newComment = await prisma.comment.create({
    data: commentData,
    include: {
      user: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      },
      _count: {
        select: {
          replies: true
        }
      }
    }
  });

  return newComment;
};

/**
 * Tính độ sâu của một comment (số cấp nested)
 * @param {number} commentId - ID của comment
 * @param {number} maxDepth - Độ sâu tối đa để kiểm tra (mặc định: 3)
 * @returns {Promise<number>} Độ sâu của comment (1 = comment gốc, 2 = reply cấp 1, ...)
 */
const calculateCommentDepth = async (commentId, maxDepth = 3) => {
  let depth = 1;
  let currentCommentId = commentId;

  // Đi ngược lên cây comment để đếm độ sâu
  while (depth < maxDepth) {
    const comment = await prisma.comment.findUnique({
      where: { id: currentCommentId },
      select: { parentId: true }
    });

    if (!comment || !comment.parentId) {
      // Đã đến comment gốc (không có parent)
      break;
    }

    depth++;
    currentCommentId = comment.parentId;
  }

  return depth;
};

/**
 * Tạo reply comment (tối đa 3 cấp)
 * @param {Object} options - Các options để config
 * @param {number} options.parentCommentId - ID của comment cha
 * @param {number} options.userId - ID của user đang reply
 * @param {string} options.content - Nội dung reply
 * @returns {Promise<Object>} Comment object đã được tạo với user và _count
 */
export const createReplyComment = async ({ parentCommentId, userId, content }) => {
  const MAX_DEPTH = 3; // Giới hạn độ sâu tối đa

  // Lấy comment cha để kiểm tra
  const parentComment = await prisma.comment.findUnique({
    where: { id: parentCommentId },
    select: { 
      id: true, 
      parentId: true, 
      postId: true, 
      repostId: true,
      deletedAt: true
    }
  });
 
  if (!parentComment || parentComment.deletedAt) {
    throw new Error('Comment cha không tồn tại hoặc đã bị xóa!');
  }

  // Kiểm tra độ sâu của comment cha
  const parentDepth = await calculateCommentDepth(parentCommentId, MAX_DEPTH);
  
  if (parentDepth >= MAX_DEPTH) {
    throw new Error(`Không thể reply comment này. Đã đạt giới hạn tối đa ${MAX_DEPTH} cấp nested!`);
  }

  // Tạo reply comment
  const replyData = {
    content,
    userId,
    parentId: parentCommentId,
    ...(parentComment.postId ? { postId: parentComment.postId } : { repostId: parentComment.repostId })
  };

  const newReply = await prisma.comment.create({
    data: replyData,
    include: {
      user: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      },
      parent: {
        select: {
          id: true,
          user: {
            select: { id: true, username: true, fullName: true, avatarUrl: true }
          }
        }
      },
      _count: {
        select: {
          replies: true
        }
      }
    }
  });

  return newReply;
};

/**
 * Lấy replies của một comment với pagination
 * @param {Object} options - Các options để config
 * @param {number} options.parentId - ID của comment cha
 * @param {number} options.page - Số trang (mặc định: 1)
 * @param {number} options.limit - Số lượng items mỗi trang (mặc định: 20)
 * @param {string} options.sortBy - Sắp xếp ('desc' hoặc 'asc', mặc định: 'desc')
 * @returns {Promise<{replies: Array, pagination: Object}>}
 */
export const fetchReplies = async ({
  parentId,
  page = 1,
  limit = 20,
  sortBy = "desc",
}) => {
  const skip = (page - 1) * limit;

  const [replies, totalReplies] = await Promise.all([
    prisma.comment.findMany({
      where: {
        parentId: parentId,
        deletedAt: null
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
        parent: {
          select: {
            id: true,
            user: {
              select: { id: true, username: true, fullName: true, avatarUrl: true }
            }
          }
        },
        _count: {
          select: {
            replies: true
          }
        }
      },
      orderBy: { createdAt: sortBy },
      skip,
      take: limit
    }),

    prisma.comment.count({ 
      where: {
        parentId: parentId,
        deletedAt: null
      }
    })
  ]);

  const totalPages = Math.ceil(totalReplies / limit);

  return {
    replies,
    pagination: {
      currentPage: page,
      limit,
      totalReplies,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }
  };
};


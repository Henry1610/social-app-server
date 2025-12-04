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


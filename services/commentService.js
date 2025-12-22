import prisma from "../utils/prisma.js";
import { isFollowing } from "./followService.js";
import { createNotification } from "./notificationService.js";
import * as commentRepository from "../repositories/commentRepository.js";
import * as postRepository from "../repositories/postRepository.js";
import * as repostRepository from "../repositories/repostRepository.js";

/**
 * Kiểm tra quyền comment dựa trên whoCanComment setting
 * @param {number} userId - ID của user đang cố comment
 * @param {object} post - Post object có userId và whoCanComment
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
export const checkCommentPermission = async (userId, post) => {
  // Chủ post/repost luôn được comment, bất kể setting
  if (post.userId === userId) {
    return { allowed: true };
  }

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
      // Đã check ở trên rồi, nhưng để an toàn vẫn check lại
      return { allowed: false, message: "Chỉ chủ post mới được comment" };
      
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
}) => {
  const countSelect = { replies: true };

  const include = {
    user: {
      select: { id: true, username: true, fullName: true, avatarUrl: true }
    },
    _count: {
      select: countSelect
    }
  };

  const result = await commentRepository.getCommentsWithPagination({
    where,
    page,
    limit,
    sortBy,
    include,
    countSelect
  });

  return {
    comments: result.comments,
    pagination: {
      currentPage: page,
      limit,
      totalComments: result.totalComments,
      totalPages: result.totalPages,
      hasNextPage: page < result.totalPages,
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

  const include = {
    user: {
      select: { id: true, username: true, fullName: true, avatarUrl: true }
    },
    _count: {
      select: {
        replies: true
      }
    }
  };

  // Tạo comment
  const newComment = await commentRepository.createComment(commentData, include);

  return newComment;
};

/**
 * Tính độ sâu của một comment (số cấp nested)
 * @param {number} commentId - ID của comment
 * @param {number} maxDepth - Độ sâu tối đa để kiểm tra (mặc định: 3)
 * @returns {Promise<number>} Độ sâu của comment (1 = comment gốc, 2 = reply cấp 1, ...)
 */
// Sử dụng calculateCommentDepth từ repository
const calculateCommentDepth = commentRepository.calculateCommentDepth;

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
  const parentComment = await commentRepository.findCommentById(parentCommentId, {
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

  const include = {
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
  };

  const newReply = await commentRepository.createComment(replyData, include);

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
  const include = {
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
  };

  const result = await commentRepository.getRepliesWithPagination({
    parentId,
    page,
    limit,
    sortBy,
    include
  });

  return {
    replies: result.replies,
    pagination: {
      currentPage: page,
      limit,
      totalReplies: result.totalReplies,
      totalPages: result.totalPages,
      hasNextPage: page < result.totalPages,
      hasPrevPage: page > 1,
    }
  };
};

/**
 * Lấy post theo ID
 * @param {number} postId - ID của post
 * @returns {Promise<Object|null>} Post object hoặc null
 */
export const getPostByIdService = async (postId) => {
  return await postRepository.findPostById(postId);
};

/**
 * Lấy repost theo ID với post gốc
 * @param {number} repostId - ID của repost
 * @returns {Promise<Object|null>} Repost object với post hoặc null
 */
export const getRepostByIdWithPostService = async (repostId) => {
  const repost = await repostRepository.findRepostById(repostId);
  if (!repost || repost.deletedAt) {
    return null;
  }
  
  // Kiểm tra post gốc còn tồn tại
  const post = await postRepository.findPostById(repost.postId);
  if (!post) {
    return null;
  }

  return {
    ...repost,
    post
  };
};

/**
 * Xóa comment (soft delete)
 * @param {number} commentId - ID của comment
 * @param {number} userId - ID của user (để kiểm tra quyền)
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const deleteCommentService = async (commentId, userId) => {
  // Kiểm tra comment có tồn tại và thuộc về user
  const comment = await commentRepository.findCommentByIdWithWhere(
    commentId,
    { userId, deletedAt: null },
    { id: true, postId: true, repostId: true }
  );

  if (!comment) {
    return {
      success: false,
      message: 'Bình luận không tồn tại hoặc bạn không có quyền xóa!'
    };
  }

  // Xóa mềm
  await commentRepository.softDeleteComment(commentId);

  return {
    success: true,
    message: 'Bình luận đã được xóa!'
  };
};

/**
 * Lấy comment theo ID với include
 * @param {number} commentId - ID của comment
 * @param {Object} include - Include options
 * @returns {Promise<Object|null>} Comment object hoặc null
 */
export const getCommentByIdService = async (commentId, include = {}) => {
  return await commentRepository.findCommentById(commentId, { include });
};

/**
 * Kiểm tra post có tồn tại không
 * @param {number} postId - ID của post
 * @returns {Promise<Object|null>} Post object hoặc null
 */
export const checkPostExistsService = async (postId) => {
  return await postRepository.findPostById(postId, { id: true });
};

/**
 * Kiểm tra repost có tồn tại không và post gốc còn tồn tại
 * @param {number} repostId - ID của repost
 * @returns {Promise<Object|null>} Repost object hoặc null
 */
export const checkRepostExistsService = async (repostId) => {
  const repost = await repostRepository.findRepostById(repostId);
  if (!repost || repost.deletedAt) {
    return null;
  }
  
  // Kiểm tra post gốc còn tồn tại
  const post = await postRepository.findPostById(repost.postId);
  if (!post) {
    return null;
  }

  return { id: repost.id };
};

/**
 * Kiểm tra comment có tồn tại không
 * @param {number} commentId - ID của comment
 * @returns {Promise<Object|null>} Comment object hoặc null
 */
export const checkCommentExistsService = async (commentId) => {
  return await commentRepository.findCommentByIdWithWhere(
    commentId,
    { deletedAt: null },
    { id: true }
  );
};

/**
 * Lấy comments của một post (service layer)
 * @param {number} postId - ID của post
 * @param {Object} options - Query options
 * @returns {Promise<{success: boolean, comments?: Array, pagination?: Object, message?: string}>}
 */
export const getCommentsByPostService = async (postId, options = {}) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const sortBy = options.sortBy || 'desc';

  // Kiểm tra post có tồn tại không
  const post = await checkPostExistsService(postId);
  if (!post) {
    return {
      success: false,
      message: 'Bài viết không tồn tại hoặc đã bị xóa!'
    };
  }

  // Lấy comments
  const result = await fetchComments({
    where: {
      postId: postId,
      parentId: null,
      deletedAt: null
    },
    page,
    limit,
    sortBy,
    includeMentions: false
  });

  return {
    success: true,
    comments: result.comments,
    pagination: result.pagination
  };
};

/**
 * Tạo comment cho post (service layer)
 * @param {number} postId - ID của post
 * @param {number} userId - ID của user
 * @param {string} content - Nội dung comment
 * @returns {Promise<{success: boolean, comment?: Object, message?: string, statusCode?: number}>}
 */
export const commentPostService = async (postId, userId, content) => {
  // Kiểm tra bài viết có tồn tại không
  const post = await getPostByIdService(postId);
  if (!post) {
    return {
      success: false,
      message: 'Bài viết không tồn tại hoặc đã bị xóa!',
      statusCode: 404
    };
  }

  // Kiểm tra quyền comment
  const permissionCheck = await checkCommentPermission(userId, post);
  if (!permissionCheck.allowed) {
    return {
      success: false,
      message: permissionCheck.message,
      statusCode: 403
    };
  }

  // Tạo comment
  const newComment = await createComment({
    type: 'post',
    entityId: postId,
    userId,
    content
  });

  // Gửi thông báo cho chủ post (nếu không phải chính họ comment)
  if (post.userId !== userId) {
    try {
      await createNotification({
        userId: post.userId,
        actorId: userId,
        type: "COMMENT",
        targetType: "POST",
        targetId: postId,
      });
    } catch (error) {
      console.error("Error creating notification in commentPostService:", error);
    }
  }

  return {
    success: true,
    message: 'Bình luận đã được thêm!',
    comment: newComment
  };
};

/**
 * Lấy comments của một repost (service layer)
 * @param {number} repostId - ID của repost
 * @param {Object} options - Query options
 * @returns {Promise<{success: boolean, comments?: Array, pagination?: Object, message?: string}>}
 */
export const getCommentsByRepostService = async (repostId, options = {}) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const sortBy = options.sortBy || 'desc';

  // Kiểm tra repost có tồn tại không
  const repost = await checkRepostExistsService(repostId);
  if (!repost) {
    return {
      success: false,
      message: 'Repost không tồn tại, đã bị xóa hoặc bài viết gốc đã bị xóa!'
    };
  }

  // Lấy comments
  const result = await fetchComments({
    where: {
      repostId: repostId,
      parentId: null,
      deletedAt: null
    },
    page,
    limit,
    sortBy,
    includeMentions: true
  });

  return {
    success: true,
    comments: result.comments,
    pagination: result.pagination
  };
};

/**
 * Tạo comment cho repost (service layer)
 * @param {number} repostId - ID của repost
 * @param {number} userId - ID của user
 * @param {string} content - Nội dung comment
 * @returns {Promise<{success: boolean, comment?: Object, message?: string, statusCode?: number}>}
 */
export const commentRepostService = async (repostId, userId, content) => {
  // Lấy repost và post gốc
  const repost = await getRepostByIdWithPostService(repostId);
  if (!repost) {
    return {
      success: false,
      message: 'Repost không tồn tại, đã bị xóa hoặc bài viết gốc đã bị xóa!',
      statusCode: 404
    };
  }

  // Kiểm tra quyền comment dựa trên chủ repost
  // Tạo object giả để check permission với chủ repost
  const repostOwnerPost = {
    userId: repost.userId,
    whoCanComment: repost.post.whoCanComment || 'everyone' // Lấy setting từ post gốc
  };
  const permissionCheck = await checkCommentPermission(userId, repostOwnerPost);
  if (!permissionCheck.allowed) {
    return {
      success: false,
      message: permissionCheck.message,
      statusCode: 403
    };
  }

  // Tạo comment
  const newComment = await createComment({
    type: 'repost',
    entityId: repostId,
    userId,
    content
  });

  // Gửi thông báo:
  // - Nếu người comment là chủ repost, KHÔNG gửi notification cho ai cả
  // - Nếu người comment không phải chủ repost, gửi notification cho chủ repost
  // - Nếu chủ repost khác chủ post gốc và người comment không phải chủ post gốc, cũng gửi cho chủ post gốc
  if (repost.userId !== userId) {
    try {
      // Gửi notification cho chủ repost
      await createNotification({
        userId: repost.userId,
        actorId: userId,
        type: "COMMENT",
        targetType: "REPOST",
        targetId: repostId,
      });
    } catch (error) {
      console.error("Error creating notification in commentRepostService (repost owner):", error);
    }

    // Nếu chủ repost khác chủ post gốc và người comment không phải chủ post gốc, gửi notification cho chủ post gốc
    if (repost.post.userId !== repost.userId && repost.post.userId !== userId) {
      try {
        await createNotification({
          userId: repost.post.userId,
          actorId: userId,
          type: "COMMENT",
          targetType: "POST",
          targetId: repost.post.id,
        });
      } catch (error) {
        console.error("Error creating notification in commentRepostService (post owner):", error);
      }
    }
  }

  return {
    success: true,
    message: 'Bình luận đã được thêm!',
    comment: newComment
  };
};

/**
 * Tạo reply comment (service layer)
 * @param {number} parentCommentId - ID của comment cha
 * @param {number} userId - ID của user
 * @param {string} content - Nội dung reply
 * @returns {Promise<{success: boolean, reply?: Object, message?: string, statusCode?: number}>}
 */
export const replyCommentService = async (parentCommentId, userId, content) => {
  // Lấy comment cha
  const parentComment = await getCommentByIdService(parentCommentId, {
    post: {
      select: { id: true, userId: true, whoCanComment: true, deletedAt: true }
    },
    repost: {
      include: {
        post: {
          select: { id: true, userId: true, whoCanComment: true, deletedAt: true }
        }
      }
    }
  });

  if (!parentComment || parentComment.deletedAt) {
    return {
      success: false,
      message: 'Comment không tồn tại hoặc đã bị xóa!',
      statusCode: 404
    };
  }

  // Lấy post để kiểm tra quyền
  const post = parentComment.post || (parentComment.repost && parentComment.repost.post);
  if (!post || post.deletedAt) {
    return {
      success: false,
      message: 'Bài viết không tồn tại hoặc đã bị xóa!',
      statusCode: 404
    };
  }

  // Kiểm tra quyền comment
  const permissionCheck = await checkCommentPermission(userId, post);
  if (!permissionCheck.allowed) {
    return {
      success: false,
      message: permissionCheck.message,
      statusCode: 403
    };
  }

  // Tạo reply
  const newReply = await createReplyComment({
    parentCommentId,
    userId,
    content
  });

  // Gửi thông báo cho chủ comment
  if (parentComment.userId !== userId) {
    try {
      const metadata = {};
      if (post.id) {
        metadata.postId = post.id;
      }
      if (parentComment.repostId) {
        metadata.repostId = parentComment.repostId;
      }

      await createNotification({
        userId: parentComment.userId,
        actorId: userId,
        type: "REPLY",
        targetType: "COMMENT",
        targetId: parentCommentId,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      });
    } catch (error) {
      console.error("Error creating notification in replyCommentService:", error);
    }
  }

  return {
    success: true,
    message: 'Phản hồi đã được thêm!',
    reply: newReply
  };
};

/**
 * Lấy replies của một comment (service layer)
 * @param {number} parentCommentId - ID của comment cha
 * @param {Object} options - Query options
 * @returns {Promise<{success: boolean, replies?: Array, pagination?: Object, message?: string}>}
 */
export const getRepliesByCommentService = async (parentCommentId, options = {}) => {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const sortBy = options.sortBy || 'desc';

  // Kiểm tra comment cha có tồn tại không
  const parentComment = await checkCommentExistsService(parentCommentId);
  if (!parentComment) {
    return {
      success: false,
      message: 'Comment không tồn tại hoặc đã bị xóa!'
    };
  }

  // Lấy replies
  const result = await fetchReplies({
    parentId: parentCommentId,
    page,
    limit,
    sortBy
  });

  return {
    success: true,
    replies: result.replies,
    pagination: result.pagination
  };
};


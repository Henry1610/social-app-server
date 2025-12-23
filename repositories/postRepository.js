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

/**
 * Tìm post theo ID (unique, có thể bao gồm đã xóa)
 * @param {number} postId - ID của post
 * @param {Object} select - Select fields
 * @returns {Promise<Object|null>} Post record hoặc null
 */
export const findPostByIdUnique = async (postId, select = {}) => {
  return await prisma.post.findUnique({
    where: { id: postId },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tìm post theo userId và postId (để kiểm tra quyền)
 * @param {number} postId - ID của post
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} Post record hoặc null
 */
export const findPostByUserIdAndPostId = async (postId, userId) => {
  return await prisma.post.findFirst({
    where: {
      id: postId,
      userId: userId,
      deletedAt: null
    }
  });
};

/**
 * Soft delete post (cập nhật deletedAt)
 * @param {number} postId - ID của post
 * @returns {Promise<Object>} Updated post record
 */
export const updatePostDeletedAt = async (postId) => {
  return await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() }
  });
};

/**
 * Tìm posts theo userId với điều kiện where
 * @param {Object} whereClause - Where conditions
 * @param {Object} select - Select fields
 * @param {Object} options - Options (skip, take, orderBy)
 * @returns {Promise<Array>} Danh sách posts
 */
export const findPostsByWhere = async (whereClause, select = {}, options = {}) => {
  const { skip, take, orderBy } = options;
  
  return await prisma.post.findMany({
    where: whereClause,
    select: Object.keys(select).length > 0 ? select : undefined,
    skip,
    take,
    orderBy: orderBy || { createdAt: 'desc' }
  });
};

// ============ Reaction Operations ============

/**
 * Đếm số lượng reactions của một post
 * @param {number} postId - ID của post
 * @param {string} targetType - Target type (POST, REPOST, etc.)
 * @returns {Promise<number>} Số lượng reactions
 */
export const countReactionsByPostId = async (postId, targetType = 'POST') => {
  return await prisma.reaction.count({
    where: { targetId: postId, targetType: targetType.toUpperCase() }
  });
};

// ============ Repost Operations ============

/**
 * Lấy danh sách reposts theo postId
 * @param {number} postId - ID của post
 * @param {Object} options - Options (take, include)
 * @returns {Promise<Array>} Danh sách reposts
 */
export const findRepostsByPostId = async (postId, options = {}) => {
  const { take, include = {} } = options;
  
  return await prisma.repost.findMany({
    where: {
      postId: postId,
      deletedAt: null
    },
    include: Object.keys(include).length > 0 ? include : {
      user: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    ...(take && { take })
  });
};

/**
 * Tìm repost theo userId và postId
 * @param {number} userId - ID của user
 * @param {number} postId - ID của post
 * @param {Object} include - Include options
 * @returns {Promise<Object|null>} Repost record hoặc null
 */
export const findRepostByUserAndPost = async (userId, postId, include = {}) => {
  return await prisma.repost.findFirst({
    where: {
      userId: userId,
      postId: postId,
      deletedAt: null
    },
    include: Object.keys(include).length > 0 ? include : {
      user: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      }
    }
  });
};

/**
 * Group reposts theo postId và đếm
 * @param {Array<number>} postIds - Danh sách post IDs
 * @returns {Promise<Array>} Kết quả groupBy
 */
export const groupRepostsByPostId = async (postIds) => {
  return await prisma.repost.groupBy({
    by: ['postId'],
    where: {
      postId: { in: postIds },
      deletedAt: null
    },
    _count: {
      id: true
    }
  });
};

// ============ SavedPost Operations ============

/**
 * Tìm post đơn giản (chỉ id) để kiểm tra tồn tại
 * @param {number} postId - ID của post
 * @returns {Promise<Object|null>} Post record hoặc null
 */
export const findPostByIdBasic = async (postId) => {
  return await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true }
  });
};

/**
 * Upsert saved post
 * @param {number} userId - ID của user
 * @param {number} postId - ID của post
 * @returns {Promise<Object>} SavedPost record
 */
export const upsertSavedPost = async (userId, postId) => {
  return await prisma.savedPost.upsert({
    where: { userId_postId: { userId: userId, postId: postId } },
    update: {},
    create: {
      userId: userId,
      postId: postId,
      savedAt: new Date()
    }
  });
};

/**
 * Xóa saved post
 * @param {number} userId - ID của user
 * @param {number} postId - ID của post
 * @returns {Promise<Object>} Kết quả delete
 */
export const deleteSavedPost = async (userId, postId) => {
  return await prisma.savedPost.deleteMany({
    where: { userId: userId, postId: postId }
  });
};

// ============ PostView Operations ============

/**
 * Upsert post view
 * @param {number} postId - ID của post
 * @param {number} userId - ID của user
 * @returns {Promise<Object>} PostView record
 */
export const upsertPostView = async (postId, userId) => {
  return await prisma.postView.upsert({
    where: {
      postId_userId: {
        postId: postId,
        userId: userId
      }
    },
    update: {
      viewedAt: new Date()
    },
    create: {
      postId: postId,
      userId: userId,
      viewedAt: new Date()
    }
  });
};

// ============ Transaction Operations ============

/**
 * Create post với transaction (bao gồm media)
 * @param {Function} tx - Transaction callback
 * @param {Object} data - Post data
 * @param {number} data.userId - ID của user
 * @param {string} data.content - Nội dung post
 * @param {Array} data.mediaUrls - Danh sách media URLs
 * @param {Object} data.privacySettings - Privacy settings
 * @returns {Promise<Object>} Created post
 */
export const createPostWithTransaction = async (tx, data) => {
  const createdPost = await tx.post.create({
    data: {
      content: data.content || null,
      user: { connect: { id: data.userId } },
      whoCanSee: data.privacySettings?.whoCanSee || 'everyone',
      whoCanComment: data.privacySettings?.whoCanComment || 'everyone',
    },
  });

  // Tạo media nếu có
  if (data.mediaUrls && data.mediaUrls.length > 0) {
    const mediaData = data.mediaUrls.map(m => ({
      postId: createdPost.id,
      mediaUrl: m.url,
      mediaType: m.type || 'image',
    }));
    await tx.postMedia.createMany({ data: mediaData });
  }

  return createdPost;
};

/**
 * Update post với transaction (bao gồm media)
 * @param {Function} tx - Transaction callback
 * @param {Object} data - Update data
 * @param {number} data.postId - ID của post
 * @param {number} data.userId - ID của user
 * @param {string} data.content - Nội dung mới
 * @param {Array} data.mediaUrls - Danh sách media URLs mới (undefined = không thay đổi)
 * @param {Object} data.privacySettings - Privacy settings mới
 * @returns {Promise<Object>} Updated post
 */
export const updatePostWithTransaction = async (tx, data) => {
  // Lấy post hiện tại để có dữ liệu mặc định
  const existingPost = await tx.post.findFirst({
    where: { id: data.postId, userId: data.userId, deletedAt: null }
  });

  if (!existingPost) {
    throw new Error('Bài viết không tồn tại hoặc không thuộc về bạn!');
  }

  // Prepare update data
  const updateData = {
    content: data.content ?? existingPost.content,
    updatedAt: new Date()
  };

  // Privacy settings
  if (data.privacySettings && Object.keys(data.privacySettings).length > 0) {
    if (data.privacySettings.whoCanSee !== undefined) {
      updateData.whoCanSee = data.privacySettings.whoCanSee;
    }
    if (data.privacySettings.whoCanComment !== undefined) {
      updateData.whoCanComment = data.privacySettings.whoCanComment;
    }
  }

  // Update main post
  const post = await tx.post.update({
    where: { id: data.postId },
    data: updateData,
  });

  // Media
  if (data.mediaUrls !== undefined) {
    await tx.postMedia.deleteMany({ where: { postId: post.id } });
    if (data.mediaUrls.length > 0) {
      await tx.postMedia.createMany({
        data: data.mediaUrls.map(m => ({
          postId: post.id,
          mediaUrl: m.mediaUrl,
          mediaType: m.type || 'image',
          createdAt: new Date(),
        })),
      });
    }
  }

  return post;
};

// ============ SavedPost Operations (Extended) ============

/**
 * Lấy danh sách saved posts với include
 * @param {number} userId - ID của user
 * @param {Object} options - Options
 * @param {number} options.page - Số trang
 * @param {number} options.limit - Số lượng items mỗi trang
 * @param {Object} options.include - Include options
 * @returns {Promise<Array>} Danh sách saved posts
 */
export const findSavedPostsByUserId = async (userId, options = {}) => {
  const { page = 1, limit = 10, include = {} } = options;
  const skip = (page - 1) * limit;

  return await prisma.savedPost.findMany({
    where: { userId: userId, post: { deletedAt: null } },
    include: Object.keys(include).length > 0 ? include : {
      post: {
        include: {
          user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          media: { orderBy: { createdAt: 'asc' } },
          _count: { select: { comments: true, reposts: true, savedPosts: true } },
        },
      },
    },
    orderBy: { savedAt: 'desc' },
    skip,
    take: parseInt(limit),
  });
};

/**
 * Đếm số saved posts của user
 * @param {number} userId - ID của user
 * @returns {Promise<number>} Tổng số saved posts
 */
export const countSavedPostsByUserId = async (userId) => {
  return await prisma.savedPost.count({
    where: { userId: userId, post: { deletedAt: null } },
  });
};

/**
 * Lấy saved posts với select (để check đã save chưa)
 * @param {number} userId - ID của user
 * @param {Array<number>} postIds - Danh sách post IDs
 * @returns {Promise<Array>} Danh sách saved posts với postId
 */
export const findSavedPostsByUserAndPostIds = async (userId, postIds) => {
  return await prisma.savedPost.findMany({
    where: {
      userId: userId,
      postId: { in: postIds }
    },
    select: { postId: true }
  });
};

// ============ Complex Query Operations ============

/**
 * Lấy danh sách posts với complex where clause
 * @param {Object} whereClause - Where conditions
 * @param {Object} include - Include options
 * @param {Object} options - Options (skip, take, orderBy)
 * @returns {Promise<Array>} Danh sách posts
 */
export const findPostsWithInclude = async (whereClause, include = {}, options = {}) => {
  const { skip, take, orderBy } = options;
  
  return await prisma.post.findMany({
    where: whereClause,
    include: Object.keys(include).length > 0 ? include : undefined,
    skip,
    take,
    orderBy: orderBy || { createdAt: 'desc' }
  });
};

/**
 * Đếm posts với complex where clause
 * @param {Object} whereClause - Where conditions
 * @returns {Promise<number>} Tổng số posts
 */
export const countPostsWithWhere = async (whereClause) => {
  return await prisma.post.count({
    where: whereClause
  });
};

/**
 * Lấy reposts với complex where clause
 * @param {Object} whereClause - Where conditions
 * @param {Object} include - Include options
 * @param {Object} options - Options (skip, take, orderBy)
 * @returns {Promise<Array>} Danh sách reposts
 */
export const findRepostsWithInclude = async (whereClause, include = {}, options = {}) => {
  const { skip, take, orderBy } = options;
  
  return await prisma.repost.findMany({
    where: whereClause,
    include: Object.keys(include).length > 0 ? include : undefined,
    skip,
    take,
    orderBy: orderBy || { createdAt: 'desc' }
  });
};

/**
 * Đếm reposts với complex where clause
 * @param {Object} whereClause - Where conditions
 * @returns {Promise<number>} Tổng số reposts
 */
export const countRepostsWithWhere = async (whereClause) => {
  return await prisma.repost.count({
    where: whereClause
  });
};

/**
 * Lấy reactions của user cho nhiều targets
 * @param {number} userId - ID của user
 * @param {Array<number>} targetIds - Danh sách target IDs
 * @param {string} targetType - Target type (POST, REPOST, etc.)
 * @param {Object} select - Select fields
 * @returns {Promise<Array>} Danh sách reactions
 */
export const findReactionsByUserAndTargetIds = async (userId, targetIds, targetType, select = { targetId: true }) => {
  return await prisma.reaction.findMany({
    where: {
      userId: userId,
      targetId: { in: targetIds },
      targetType: targetType.toUpperCase()
    },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Lấy reposts của user cho nhiều postIds
 * @param {number} userId - ID của user
 * @param {Array<number>} postIds - Danh sách post IDs
 * @param {Object} select - Select fields
 * @returns {Promise<Array>} Danh sách reposts với postId
 */
export const findRepostsByUserAndPostIds = async (userId, postIds, select = { postId: true }) => {
  return await prisma.repost.findMany({
    where: {
      userId: userId,
      postId: { in: postIds },
      deletedAt: null
    },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Lấy post views của user cho nhiều posts
 * @param {number} userId - ID của user
 * @param {Array<number>} postIds - Danh sách post IDs (có thể null)
 * @param {Array<number>} repostIds - Danh sách repost IDs (có thể null)
 * @param {Object} select - Select fields
 * @returns {Promise<Array>} Danh sách post views
 */
export const findPostViewsByUser = async (userId, postIds = [], repostIds = [], select = { postId: true, repostId: true }) => {
  const whereClause = { userId: userId };
  
  if (postIds.length > 0 && repostIds.length > 0) {
    whereClause.OR = [
      { postId: { in: postIds, not: null } },
      { repostId: { in: repostIds, not: null } }
    ];
  } else if (postIds.length > 0) {
    whereClause.postId = { in: postIds, not: null };
  } else if (repostIds.length > 0) {
    whereClause.repostId = { in: repostIds, not: null };
  }

  return await prisma.postView.findMany({
    where: whereClause,
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

// ============ Comment GroupBy Operations ============

/**
 * Group comments theo postId
 * @param {Array<number>} postIds - Danh sách post IDs
 * @returns {Promise<Array>} Kết quả groupBy
 */
export const groupCommentsByPostId = async (postIds) => {
  return await prisma.comment.groupBy({
    by: ['postId'],
    where: {
      postId: { in: postIds },
      repostId: null,
      deletedAt: null
    },
    _count: {
      id: true
    }
  });
};

/**
 * Group comments theo repostId
 * @param {Array<number>} repostIds - Danh sách repost IDs
 * @returns {Promise<Array>} Kết quả groupBy
 */
export const groupCommentsByRepostId = async (repostIds) => {
  return await prisma.comment.groupBy({
    by: ['repostId'],
    where: {
      repostId: { in: repostIds },
      postId: null,
      deletedAt: null
    },
    _count: {
      id: true
    }
  });
};


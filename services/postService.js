import prisma from "../utils/prisma.js";
import * as postRepository from "../repositories/postRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as followRepository from "../repositories/followRepository.js";
import * as reactionRepository from "../repositories/reactionRepository.js";
import { getReactionCounts } from "../utils/postStatsHelper.js";
import { isFollowing } from "./followService.js";

// Helper: User select fields (dùng chung cho nhiều queries)
export const userSelectFields = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true
};

// Helper: Post include pattern (dùng chung)
export const postIncludeBasic = {
  user: { select: userSelectFields },
  media: true,
  _count: {
    select: {
      comments: true,
      reposts: true,
      savedPosts: true
    }
  }
};

/**
 * Tạo post mới với transaction
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user tạo post
 * @param {string} options.content - Nội dung post
 * @param {Array} options.mediaUrls - Danh sách media URLs
 * @param {Object} options.privacySettings - Privacy settings
 * @returns {Promise<Object>} Post đã được tạo
 */
export const createPostService = async ({ userId, content, mediaUrls = [], privacySettings = {} }) => {
  // Transaction
  const post = await prisma.$transaction(async (tx) => {
    return await postRepository.createPostWithTransaction(tx, {
      userId,
      content,
      mediaUrls,
      privacySettings
    });
  });

  // Fetch full post với relations
  const completePost = await postRepository.findPostByIdUnique(post.id, postIncludeBasic);

  return completePost;
};

/**
 * Cập nhật post với transaction
 * @param {Object} options - Các options
 * @param {number} options.postId - ID của post
 * @param {number} options.userId - ID của user
 * @param {string} options.content - Nội dung mới
 * @param {Array} options.mediaUrls - Danh sách media URLs mới (undefined = không thay đổi)
 * @param {Object} options.privacySettings - Privacy settings mới
 * @returns {Promise<Object>} Post đã được cập nhật với reaction count
 */
export const updatePostService = async ({ postId, userId, content, mediaUrls, privacySettings = {} }) => {
  // Transaction
  await prisma.$transaction(async (tx) => {
    return await postRepository.updatePostWithTransaction(tx, {
      postId,
      userId,
      content,
      mediaUrls,
      privacySettings
    });
  });

  // Fetch complete post với relations sau khi transaction hoàn thành
  const completePost = await postRepository.findPostByIdUnique(postId, postIncludeBasic);

  // Lấy reaction count
  const reactionCount = await postRepository.countReactionsByPostId(postId, 'POST');
  completePost._count.reactions = reactionCount;

  return completePost;
};

/**
 * Kiểm tra quyền truy cập post dựa trên privacy settings
 * @param {Object} options - Các options
 * @param {Object} options.post - Post object với whoCanSee
 * @param {number} options.currentUserId - ID của user hiện tại (có thể null)
 * @param {number} options.postOwnerId - ID của chủ post
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
export const checkPostAccess = async ({ post, currentUserId, postOwnerId }) => {
  const isPostOwner = postOwnerId === currentUserId;

  // Nếu là chủ post thì luôn được xem
  if (isPostOwner) {
    return { allowed: true };
  }

  const whoCanSee = post.whoCanSee || 'everyone';

  // Nếu whoCanSee = 'nobody', chỉ chủ post mới xem được
  if (whoCanSee === 'nobody') {
    return {
      allowed: false,
      message: 'Bài viết này là riêng tư và chỉ chủ bài viết mới xem được!'
    };
  }

  // Nếu whoCanSee = 'followers', cần kiểm tra follow
  if (whoCanSee === 'followers') {
    if (!currentUserId) {
      return {
        allowed: false,
        message: 'Bạn cần đăng nhập và theo dõi để xem bài viết này!'
      };
    }

    const { isFollowing } = await import('./followService.js');
    const isFollowingPost = await isFollowing(currentUserId, postOwnerId);

    if (!isFollowingPost) {
      return {
        allowed: false,
        message: 'Bạn cần theo dõi để xem bài viết này!'
      };
    }
  }

  return { allowed: true };
};

/**
 * Kiểm tra quyền xem posts của một user (private account check)
 * @param {Object} options - Các options
 * @param {number} options.currentUserId - ID của user hiện tại (có thể null)
 * @param {number} options.targetUserId - ID của target user
 * @returns {Promise<{allowed: boolean, message?: string, user?: Object}>}
 */
export const checkUserPostsAccess = async ({ currentUserId, targetUserId }) => {
  // Nếu xem chính mình thì luôn được
  if (currentUserId === targetUserId) {
    return { allowed: true };
  }

  // Lấy thông tin user để check privacy
  const targetUser = await userRepository.findUserByIdWithSelect(targetUserId, {
    id: true,
    privacySettings: {
      select: { isPrivate: true }
    }
  });

  if (!targetUser) {
    return {
      allowed: false,
      message: 'Người dùng không tồn tại!'
    };
  }

  const isPrivateAccount = targetUser.privacySettings?.isPrivate;

  if (isPrivateAccount) {
    if (!currentUserId) {
      return {
        allowed: false,
        message: 'Tài khoản này là riêng tư. Bạn cần đăng nhập và theo dõi để xem bài viết!'
      };
    }

    const { isFollowing } = await import('./followService.js');
    const isFollowingUser = await isFollowing(currentUserId, targetUserId);

    if (!isFollowingUser) {
      return {
        allowed: false,
        message: 'Tài khoản này là riêng tư. Bạn cần theo dõi để xem bài viết!'
      };
    }
  }

  return { allowed: true, user: targetUser };
};

/**
 * Lấy danh sách saved posts của user với pagination
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @param {number} options.page - Số trang (mặc định: 1)
 * @param {number} options.limit - Số lượng items mỗi trang (mặc định: 10)
 * @returns {Promise<{items: Array, total: number}>}
 */
export const getSavedPostsService = async ({ userId, page = 1, limit = 10 }) => {
  const [items, total] = await Promise.all([
    postRepository.findSavedPostsByUserId(userId, {
      page,
      limit,
      include: {
        post: {
          include: {
            user: { select: userSelectFields },
            media: {
              orderBy: { createdAt: 'asc' }
            },
            _count: { select: { comments: true, reposts: true, savedPosts: true } },
          },
        },
      },
    }),
    postRepository.countSavedPostsByUserId(userId),
  ]);

  // Import getReactionCounts từ helper
  const { getReactionCounts } = await import('../utils/postStatsHelper.js');
  
  // Lấy reaction counts cho tất cả saved posts
  const savedPostIds = items.map(item => item.post.id);
  const savedPostReactionCountMap = await getReactionCounts(savedPostIds, 'POST');

  // Format dữ liệu: thêm preview image và reaction count vào mỗi post
  const itemsWithReactions = items.map(item => ({
    ...item,
    post: {
      ...item.post,
      previewImage: item.post.media?.[0]?.mediaUrl || null,
      previewMediaType: item.post.media?.[0]?.mediaType || null,
      _count: {
        ...item.post._count,
        reactions: savedPostReactionCountMap[item.post.id] || 0,
      },
    },
  }));

  return {
    items: itemsWithReactions,
    total
  };
};

/**
 * Lấy feed posts (posts và reposts từ users đang follow + chính mình)
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @param {number} options.page - Số trang (mặc định: 1)
 * @param {number} options.limit - Số lượng items mỗi trang (mặc định: 20)
 * @returns {Promise<{posts: Array, total: number, page: number, limit: number}>}
 */
export const getFeedPostsService = async ({ userId, page = 1, limit = 20 }) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 1. Lấy danh sách user IDs mà current user đang follow
  const followingUserIds = await followRepository.getFollowingIdsByUserId(userId);
  const allowedUserIds = [...followingUserIds, userId];

  if (allowedUserIds.length === 0) {
    return {
      posts: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }

  // 2. Query posts và reposts song song
  const [posts, reposts] = await Promise.all([
    // Query posts
    postRepository.findPostsWithInclude(
      {
        deletedAt: null,
        OR: [
          { userId: userId },
          {
            userId: { in: followingUserIds },
            whoCanSee: { in: ['everyone', 'followers'] }
          }
        ]
      },
      {
        user: { select: userSelectFields },
        media: {
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            comments: true,
            reposts: true,
            savedPosts: true
          }
        }
      },
      {
        orderBy: { createdAt: 'desc' }
      }
    ),
    // Query reposts
    postRepository.findRepostsWithInclude(
      {
        deletedAt: null,
        userId: { in: allowedUserIds },
        post: {
          deletedAt: null,
          OR: [
            { userId: userId },
            {
              userId: { in: followingUserIds },
              whoCanSee: { in: ['everyone', 'followers'] }
            }
          ]
        }
      },
      {
        user: {
          select: userSelectFields
        },
        post: {
          include: {
            user: { select: userSelectFields },
            media: {
              orderBy: { createdAt: 'asc' }
            },
            _count: {
              select: {
                comments: true,
                reposts: true,
                savedPosts: true
              }
            }
          }
        },
        _count: {
          select: {
            comments: true
          }
        }
      },
      {
        orderBy: { createdAt: 'desc' }
      }
    )
  ]);

  // 3. Lấy tất cả IDs cần thiết
  const allPostIds = [
    ...posts.map(p => p.id),
    ...reposts.map(r => r.post.id)
  ];
  const allRepostIds = reposts.map(r => r.id);

  // 4. Aggregate counts song song
  const { getReactionCounts } = await import('../utils/postStatsHelper.js');
  
  const [
    postReactionCountMap,
    repostReactionCountMap,
    repostsCountMap,
    postCommentCountMap,
    repostCommentCountMap
  ] = await Promise.all([
    getReactionCounts(allPostIds, 'POST'),
    getReactionCounts(allRepostIds, 'REPOST'),
    postRepository.groupRepostsByPostId(allPostIds),
    postRepository.groupCommentsByPostId(allPostIds),
    postRepository.groupCommentsByRepostId(allRepostIds)
  ]);

  // 5. Tạo maps cho counts
  const repostsCountByPostId = {};
  repostsCountMap.forEach(item => {
    repostsCountByPostId[item.postId] = item._count.id;
  });

  const commentCountByPostId = {};
  postCommentCountMap.forEach(item => {
    commentCountByPostId[item.postId] = item._count.id;
  });

  const commentCountByRepostId = {};
  repostCommentCountMap.forEach(item => {
    commentCountByRepostId[item.repostId] = item._count.id;
  });

  // 6. Lấy user interactions song song
  const [
    myPostReactions,
    myRepostReactions,
    mySavedPosts,
    myReposts,
    postViews
  ] = await Promise.all([
    postRepository.findReactionsByUserAndTargetIds(userId, allPostIds, 'POST', { targetId: true }),
    postRepository.findReactionsByUserAndTargetIds(userId, allRepostIds, 'REPOST', { targetId: true }),
    postRepository.findSavedPostsByUserAndPostIds(userId, allPostIds),
    postRepository.findRepostsByUserAndPostIds(userId, allPostIds, { postId: true }),
    postRepository.findPostViewsByUser(userId, allPostIds, allRepostIds, { postId: true, repostId: true })
  ]);

  // Tách post views thành 2 mảng
  const viewedPosts = postViews.filter(v => v.postId).map(v => ({ postId: v.postId }));
  const viewedReposts = postViews.filter(v => v.repostId).map(v => ({ repostId: v.repostId }));

  // 7. Tạo Sets cho quick lookup
  const myReactionPostIds = new Set(myPostReactions.map(r => r.targetId));
  const myReactionRepostIds = new Set(myRepostReactions.map(r => r.targetId));
  const mySavedPostIds = new Set(mySavedPosts.map(s => s.postId));
  const myRepostedPostIds = new Set(myReposts.map(r => r.postId));
  const viewedPostIds = new Set(viewedPosts.map(v => v.postId).filter(Boolean));
  const viewedRepostIds = new Set(viewedReposts.map(v => v.repostId).filter(Boolean));

  // 8. Format posts
  const postsWithCounts = posts
    .filter(post => !viewedPostIds.has(post.id))
    .map(post => ({
      id: post.id,
      userId: post.userId,
      content: post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      user: post.user,
      media: post.media,
      previewImage: post.media[0]?.mediaUrl || null,
      previewMediaType: post.media[0]?.mediaType || null,
      reactionCount: postReactionCountMap[post.id] || 0,
      commentCount: commentCountByPostId[post.id] || 0,
      repostsCount: repostsCountByPostId[post.id] || 0,
      savesCount: post._count.savedPosts || 0,
      whoCanSee: post.whoCanSee,
      whoCanComment: post.whoCanComment,
      isLiked: myReactionPostIds.has(post.id),
      isSaved: mySavedPostIds.has(post.id),
      isReposted: myRepostedPostIds.has(post.id)
    }));

  // 9. Format reposts
  const repostsWithCounts = reposts
    .filter(repost => !viewedRepostIds.has(repost.id))
    .map(repost => ({
      id: repost.post.id,
      repostId: repost.id,
      userId: repost.post.userId,
      content: repost.post.content,
      createdAt: repost.createdAt,
      originalCreatedAt: repost.post.createdAt,
      updatedAt: repost.post.updatedAt,
      user: repost.post.user,
      repostedBy: repost.user,
      repostContent: repost.content,
      media: repost.post.media,
      previewImage: repost.post.media[0]?.mediaUrl || null,
      previewMediaType: repost.post.media[0]?.mediaType || null,
      reactionCount: repostReactionCountMap[repost.id] || 0,
      commentCount: commentCountByRepostId[repost.id] || 0,
      originalReactionCount: postReactionCountMap[repost.post.id] || 0,
      originalCommentCount: commentCountByPostId[repost.post.id] || 0,
      originalRepostsCount: repostsCountByPostId[repost.post.id] || 0,
      originalSavesCount: repost.post._count.savedPosts || 0,
      originalIsLiked: myReactionPostIds.has(repost.post.id),
      originalIsSaved: mySavedPostIds.has(repost.post.id),
      originalIsReposted: myRepostedPostIds.has(repost.post.id),
      whoCanSee: repost.post.whoCanSee,
      whoCanComment: repost.post.whoCanComment,
      isLiked: myReactionRepostIds.has(repost.id),
      isSaved: mySavedPostIds.has(repost.post.id),
      isReposted: myRepostedPostIds.has(repost.post.id),
      isRepost: true
    }));

  // 10. Merge và sort
  const allFeedItems = [...postsWithCounts, ...repostsWithCounts].sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // 11. Paginate
  const paginatedItems = allFeedItems.slice(skip, skip + parseInt(limit));

  // 12. Đếm total
  const [totalPosts, totalReposts] = await Promise.all([
    postRepository.countPostsWithWhere({
      deletedAt: null,
      OR: [
        { userId: userId },
        {
          userId: { in: followingUserIds },
          whoCanSee: { in: ['everyone', 'followers'] }
        }
      ]
    }),
    postRepository.countRepostsWithWhere({
      deletedAt: null,
      userId: { in: allowedUserIds },
      post: {
        deletedAt: null,
        OR: [
          { userId: userId },
          {
            userId: { in: followingUserIds },
            whoCanSee: { in: ['everyone', 'followers'] }
          }
        ]
      }
    })
  ]);

  const total = totalPosts + totalReposts;

  return {
    posts: paginatedItems,
    total,
    page: parseInt(page),
    limit: parseInt(limit)
  };
};

/**
 * Lấy post theo ID với đầy đủ thông tin
 * @param {Object} options - Các options
 * @param {number} options.postId - ID của post
 * @param {number} options.currentUserId - ID của user hiện tại
 * @returns {Promise<{success: boolean, post?: Object, message?: string, statusCode?: number}>}
 */
export const getPostByIdService = async ({ postId, currentUserId }) => {
  const post = await postRepository.findPostByIdWithInclude(postId, {
    user: { select: userSelectFields },
    media: {
      select: { id: true, mediaUrl: true, mediaType: true }
    },
    _count: { select: { comments: true, reposts: true, savedPosts: true } }
  });

  if (!post) {
    return {
      success: false,
      message: 'Bài viết không tồn tại hoặc đã bị xóa!',
      statusCode: 404
    };
  }

  // Kiểm tra quyền truy cập
  const accessCheck = await checkPostAccess({
    post,
    currentUserId,
    postOwnerId: post.userId
  });

  if (!accessCheck.allowed) {
    return {
      success: false,
      message: accessCheck.message,
      statusCode: 403
    };
  }

  // Get reaction count
  const reactionCount = await postRepository.countReactionsByPostId(postId, 'POST');

  // Lấy thêm 10 repost gần nhất
  const reposts = await postRepository.findRepostsByPostId(postId, {
    take: 10,
    include: {
      user: { select: userSelectFields }
    }
  });

  // Kiểm tra xem current user có repost post này không
  let myRepost = null;
  if (currentUserId) {
    myRepost = await postRepository.findRepostByUserAndPost(currentUserId, postId, {
      user: { select: userSelectFields }
    });
  }

  return {
    success: true,
    post: {
      ...post,
      reposts,
      isRepost: !!myRepost,
      repostedBy: myRepost?.user || null,
      repostContent: myRepost?.content || null,
      _count: {
        ...post._count,
        reactions: reactionCount
      }
    }
  };
};

/**
 * Xóa post (soft delete)
 * @param {Object} options - Các options
 * @param {number} options.postId - ID của post
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, post?: Object, message?: string, statusCode?: number}>}
 */
export const deletePostService = async ({ postId, userId }) => {
  // Kiểm tra bài viết có tồn tại và thuộc về user
  const post = await postRepository.findPostByUserIdAndPostId(postId, userId);

  if (!post) {
    return {
      success: false,
      message: 'Bài viết không tồn tại hoặc không thuộc về bạn!',
      statusCode: 404
    };
  }

  // Soft delete
  const deletedPost = await postRepository.updatePostDeletedAt(postId);

  return {
    success: true,
    message: 'Xóa bài viết thành công',
    post: deletedPost
  };
};

/**
 * Lưu post
 * @param {Object} options - Các options
 * @param {number} options.postId - ID của post
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, saved?: Object, message?: string, statusCode?: number}>}
 */
export const savePostService = async ({ postId, userId }) => {
  // Check post tồn tại
  const post = await postRepository.findPostByIdBasic(postId);

  if (!post) {
    return {
      success: false,
      message: 'Bài viết không tồn tại hoặc đã bị xoá!',
      statusCode: 404
    };
  }

  // Save hoặc bỏ qua nếu đã tồn tại
  const saved = await postRepository.upsertSavedPost(userId, postId);

  return {
    success: true,
    message: 'Đã lưu bài viết!',
    saved
  };
};

/**
 * Bỏ lưu post
 * @param {Object} options - Các options
 * @param {number} options.postId - ID của post
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const unsavePostService = async ({ postId, userId }) => {
  await postRepository.deleteSavedPost(userId, postId);

  return {
    success: true,
    message: 'Đã bỏ lưu bài viết.'
  };
};

/**
 * Lấy preview posts của user
 * @param {Object} options - Các options
 * @param {number} options.targetUserId - ID của user
 * @param {number} options.currentUserId - ID của user hiện tại
 * @param {number} options.page - Số trang
 * @param {number} options.limit - Số lượng items mỗi trang
 * @returns {Promise<{success: boolean, posts?: Array, message?: string, statusCode?: number}>}
 */
export const getUserPostsPreviewService = async ({ targetUserId, currentUserId, page = 1, limit = 12 }) => {
  // Kiểm tra quyền xem posts của user
  const accessCheck = await checkUserPostsAccess({
    currentUserId,
    targetUserId
  });

  if (!accessCheck.allowed) {
    const statusCode = accessCheck.message.includes('không tồn tại') ? 404 : 403;
    return {
      success: false,
      message: accessCheck.message,
      statusCode
    };
  }

  const isSelf = targetUserId === currentUserId;
  const skip = (page - 1) * limit;

  const whereClause = { userId: targetUserId, deletedAt: null };

  if (!isSelf && currentUserId) {
    const isFollowingUser = await isFollowing(currentUserId, targetUserId);
    whereClause.whoCanSee = isFollowingUser ? { in: ['everyone', 'followers'] } : 'everyone';
  } else if (!isSelf) {
    whereClause.whoCanSee = 'everyone';
  }

  const posts = await postRepository.findPostsByWhere(
    whereClause,
    {
      id: true,
      media: { take: 1, select: { mediaUrl: true, mediaType: true } },
      _count: { select: { comments: true, reposts: true, savedPosts: true } }
    },
    {
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }
  );

  const postIds = posts.map(p => p.id);

  // Lấy reaction counts và reposts counts cho posts
  const [reactionCountMap, repostsCountMap] = await Promise.all([
    getReactionCounts(postIds, 'POST'),
    postRepository.groupRepostsByPostId(postIds)
  ]);

  // Tạo map repostsCount: postId -> count
  const repostsCountByPostId = {};
  repostsCountMap.forEach(item => {
    repostsCountByPostId[item.postId] = item._count.id;
  });

  const postsWithCounts = posts.map(post => ({
    id: post.id,
    previewImage: post.media[0]?.mediaUrl || null,
    previewMediaType: post.media[0]?.mediaType || null,
    reactionCount: reactionCountMap[post.id] || 0,
    commentCount: post._count.comments || 0,
    repostsCount: repostsCountByPostId[post.id] || 0,
    savesCount: post._count.savedPosts || 0
  }));

  return {
    success: true,
    posts: postsWithCounts
  };
};

/**
 * Đánh dấu post đã xem
 * @param {Object} options - Các options
 * @param {number} options.postId - ID của post
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const markPostAsViewedService = async ({ postId, userId }) => {
  // Kiểm tra post có tồn tại không
  const post = await postRepository.findPostByIdUnique(postId, { id: true, deletedAt: true });

  if (!post || post.deletedAt) {
    return {
      success: false,
      message: 'Bài viết không tồn tại',
      statusCode: 404
    };
  }

  // Upsert post view
  await postRepository.upsertPostView(postId, userId);

  return {
    success: true,
    message: 'Đã đánh dấu bài viết đã xem'
  };
};


import prisma from "../utils/prisma.js";

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
    // 1. Tạo post
    const createdPost = await tx.post.create({
      data: {
        content: content || null,
        user: { connect: { id: userId } },
        whoCanSee: privacySettings.whoCanSee || 'everyone',
        whoCanComment: privacySettings.whoCanComment || 'everyone',
      },
    });

    // 2. Tạo media nếu có
    if (mediaUrls.length > 0) {
      const mediaData = mediaUrls.map(m => ({
        postId: createdPost.id,
        mediaUrl: m.url,
        mediaType: m.type || 'image',
      }));
      await tx.postMedia.createMany({ data: mediaData });
    }

    return createdPost;
  });

  // Fetch full post với relations
  const completePost = await prisma.post.findUnique({
    where: { id: post.id },
    include: postIncludeBasic,
  });

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
 * @returns {Promise<Object>} Post đã được cập nhật
 */
export const updatePostService = async ({ postId, userId, content, mediaUrls, privacySettings = {} }) => {
  // Transaction
  await prisma.$transaction(async (tx) => {
    // Lấy post hiện tại để có dữ liệu mặc định
    const existingPost = await tx.post.findFirst({
      where: { id: postId, userId: userId, deletedAt: null }
    });

    if (!existingPost) {
      throw new Error('Bài viết không tồn tại hoặc không thuộc về bạn!');
    }

    // Prepare update data
    const updateData = {
      content: content ?? existingPost.content,
      updatedAt: new Date()
    };

    // Privacy settings - update directly on Post model
    if (privacySettings && Object.keys(privacySettings).length > 0) {
      if (privacySettings.whoCanSee !== undefined) {
        updateData.whoCanSee = privacySettings.whoCanSee;
      }
      if (privacySettings.whoCanComment !== undefined) {
        updateData.whoCanComment = privacySettings.whoCanComment;
      }
    }

    // Update main post
    const post = await tx.post.update({
      where: { id: postId },
      data: updateData,
    });

    // Media
    if (mediaUrls !== undefined) {
      await tx.postMedia.deleteMany({ where: { postId: post.id } });
      if (mediaUrls.length > 0) {
        await tx.postMedia.createMany({
          data: mediaUrls.map(m => ({
            postId: post.id,
            mediaUrl: m.mediaUrl,
            mediaType: m.type || 'image',
            createdAt: new Date(),
          })),
        });
      }
    }
  });

  // Fetch complete post với relations sau khi transaction hoàn thành
  const completePost = await prisma.post.findUnique({
    where: { id: postId },
    include: postIncludeBasic,
  });

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
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      privacySettings: {
        select: { isPrivate: true }
      }
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
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.savedPost.findMany({
      where: { userId: userId, post: { deletedAt: null } },
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
      orderBy: { savedAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.savedPost.count({
      where: { userId: userId, post: { deletedAt: null } },
    }),
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
  const followingUsers = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  });

  const followingUserIds = followingUsers.map(f => f.followingId);
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
    prisma.post.findMany({
      where: {
        deletedAt: null,
        OR: [
          { userId: userId },
          {
            userId: { in: followingUserIds },
            whoCanSee: { in: ['everyone', 'followers'] }
          }
        ]
      },
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
      },
      orderBy: { createdAt: 'desc' }
    }),
    // Query reposts
    prisma.repost.findMany({
      where: {
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
      include: {
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
      orderBy: { createdAt: 'desc' }
    })
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
    prisma.repost.groupBy({
      by: ['postId'],
      where: {
        postId: { in: allPostIds },
        deletedAt: null
      },
      _count: { id: true }
    }),
    prisma.comment.groupBy({
      by: ['postId'],
      where: {
        postId: { in: allPostIds },
        repostId: null,
        deletedAt: null
      },
      _count: { id: true }
    }),
    prisma.comment.groupBy({
      by: ['repostId'],
      where: {
        repostId: { in: allRepostIds },
        postId: null,
        deletedAt: null
      },
      _count: { id: true }
    })
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
    viewedPosts,
    viewedReposts
  ] = await Promise.all([
    prisma.reaction.findMany({
      where: {
        userId: userId,
        targetId: { in: allPostIds },
        targetType: 'POST'
      },
      select: { targetId: true }
    }),
    prisma.reaction.findMany({
      where: {
        userId: userId,
        targetId: { in: allRepostIds },
        targetType: 'REPOST'
      },
      select: { targetId: true }
    }),
    prisma.savedPost.findMany({
      where: {
        userId: userId,
        postId: { in: allPostIds }
      },
      select: { postId: true }
    }),
    prisma.repost.findMany({
      where: {
        userId: userId,
        postId: { in: allPostIds },
        deletedAt: null
      },
      select: { postId: true }
    }),
    prisma.postView.findMany({
      where: {
        userId: userId,
        postId: { in: allPostIds, not: null }
      },
      select: { postId: true }
    }),
    prisma.postView.findMany({
      where: {
        userId: userId,
        repostId: { in: allRepostIds, not: null }
      },
      select: { repostId: true }
    })
  ]);

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
    prisma.post.count({
      where: {
        deletedAt: null,
        OR: [
          { userId: userId },
          {
            userId: { in: followingUserIds },
            whoCanSee: { in: ['everyone', 'followers'] }
          }
        ]
      }
    }),
    prisma.repost.count({
      where: {
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


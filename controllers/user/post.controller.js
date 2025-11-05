import prisma from "../../utils/prisma.js";
import { getReactionCounts } from "../../utils/postStatsHelper.js";

// Helper: User select fields (dùng chung cho nhiều queries)
const userSelectFields = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true
};

/*---------------------------------POST---------------------------------*/
// POST /api/user/posts
export const createPost = async (req, res) => {
  try {
    const {
      content,
      mediaUrls = [],
      privacySettings = {}
    } = req.body;
    const userId = req.user.id;

    if ((!content || content.trim() === '') && mediaUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bài viết phải có nội dung hoặc media!'
      });
    }

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

      // 3. Tạo media nếu có
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
      include: {
        user: { select: userSelectFields },
        media: true,
        _count: {
          select: {
            comments: true,
            reposts: true,
          },
        },
      },
    });


    res.json({
      success: true,
      message: 'Tạo bài viết thành công!',
      post: completePost
    });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo bài viết!'
    });
  }
};

// GET /api/user/posts/:postId
export const getMyPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user?.id || null;

    // Validate postId
    const parsedPostId = Number(postId);
    if (!postId || isNaN(parsedPostId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ!'
      });
    }

    const post = await prisma.post.findFirst({
      where: {
        id: parsedPostId,
        deletedAt: null
      },
      include: {
        user: { select: userSelectFields },
        media: {
          select: { id: true, mediaUrl: true, mediaType: true }
        },
        _count: { select: { comments: true, reposts: true, savedPosts: true } }
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc đã bị xóa!'
      });
    }

    const isPostOwner = post.userId === currentUserId;

    // Kiểm tra quyền truy cập dựa trên privacy settings
    if (!isPostOwner) {
      const whoCanSee = post.whoCanSee || 'everyone';
      
      if (whoCanSee === 'nobody') {
        return res.status(403).json({
          success: false,
          message: 'Bài viết này là riêng tư và chỉ chủ bài viết mới xem được!'
        });
      }

      if (whoCanSee === 'followers') {
        if (!currentUserId) {
          return res.status(403).json({
            success: false,
            message: 'Bạn cần đăng nhập và theo dõi để xem bài viết này!'
          });
        }

        const isFollowing = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: post.userId
            }
          }
        });

        if (!isFollowing) {
          return res.status(403).json({
            success: false,
            message: 'Bạn cần theo dõi để xem bài viết này!'
          });
        }
      }
    }

    // Get reaction count from Reaction table (only LIKE for posts)
    const reactionCount = await prisma.reaction.count({
      where: { targetId: parsedPostId, targetType: 'POST' },
    });

    // Lấy thêm 10 repost gần nhất
    const reposts = await prisma.repost.findMany({
      where: { 
        postId: parsedPostId,
        deletedAt: null
      },
      include: {
        user: { select: userSelectFields }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Kiểm tra xem current user có repost post này không
    let myRepost = null;
    if (currentUserId) {
      myRepost = await prisma.repost.findFirst({
        where: {
          userId: currentUserId,
          postId: parsedPostId,
          deletedAt: null
        },
        include: {
          user: { select: userSelectFields }
        }
      });
    }

    res.json({ 
      success: true, 
      post: { 
        ...post, 
        reposts,
        isRepost: !!myRepost,
        repostedBy: myRepost?.user || null,
        repostContent: myRepost?.content || null,
        _count: {
          ...post._count,
          reactions: reactionCount,
        },
      } 
    });
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bài viết!'
    });
  }
};

// PUT /api/user/posts/:postId
export const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const {
      content,
      mediaUrls,
      privacySettings = {}
    } = req.body;
    const userId = req.user.id;

    // Check ownership
    const existingPost = await prisma.post.findFirst({
      where: { id: Number(postId), userId: userId, deletedAt: null }
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc không thuộc về bạn!'
      });
    }

    // Transaction
    const updatedPost = await prisma.$transaction(async (tx) => {
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
        where: { id: Number(postId) },
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

      return post;
    });

    const completePost = await prisma.post.findUnique({
      where: { id: Number(postId) },
      include: {
        user: { select: userSelectFields },
        media: true,
        _count: { select: { comments: true, reposts: true, savedPosts: true } },
      },
    });

    const reactionCount = await prisma.reaction.count({
      where: { targetId: Number(postId), targetType: 'POST' },
    });

    completePost._count.reactions = reactionCount;

    res.json({
      success: true,
      message: 'Cập nhật bài viết thành công!',
      post: completePost
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật bài viết!'
    });
  }
};

// DELETE /api/user/posts/:postId
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Kiểm tra bài viết có tồn tại và thuộc về user
    const post = await prisma.post.findFirst({
      where: {
        id: Number(postId),
        userId: userId,
        deletedAt: null
      }
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc không thuộc về bạn!'
      });
    }

    // Soft delete
    const deletedPost = await prisma.post.update({
      where: { id: Number(postId) },
      data: { deletedAt: new Date() }
    });

    res.json({
      success: true,
      message: 'Xóa bài viết thành công',
      post: deletedPost
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa bài viết!' });
  }
};

/*---------------------------------SAVE POST---------------------------------*/

// POST /api/user/posts/:postId/save
export const savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    // Check post tồn tại
    const post = await prisma.post.findFirst({
      where: { id: Number(postId), deletedAt: null },
      select: { id: true },
    });
    
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại hoặc đã bị xoá!' });
    }

    // Save hoặc bỏ qua nếu đã tồn tại
    const saved = await prisma.savedPost.upsert({
      where: { userId_postId: { userId: userId, postId: Number(postId) } },
      update: {}, // nếu đã có thì không cần update gì
      create: {
        userId: userId,
        postId: Number(postId),
        savedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Đã lưu bài viết!', saved });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu bài viết!' });
  }
};

// DELETE /api/user/posts/:postId/save
export const unsavePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    await prisma.savedPost.deleteMany({
      where: { userId: userId, postId: Number(postId) },
    });

    res.json({ success: true, message: 'Đã bỏ lưu bài viết.', postId: Number(postId) });
  } catch (error) {
    console.error('Error unsaving post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi bỏ lưu bài viết!' });
  }
};

/**
 * GET /api/user/profile/:username/saved-posts
 * Lấy danh sách bài viết đã lưu của một user
 * Chỉ cho phép xem saved posts của chính mình
 */
export const getUserSavedPostsReview = async (req, res) => {
  try {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user?.id || null;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Chỉ cho phép xem saved posts của chính mình
    if (!currentUserId || targetUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể xem bài viết đã lưu của chính mình!'
      });
    }

    const [items, total] = await Promise.all([
      prisma.savedPost.findMany({
        where: { userId: targetUserId, post: { deletedAt: null } },
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
        where: { userId: targetUserId, post: { deletedAt: null } },
      }),
    ]);

    // Lấy reaction counts cho tất cả saved posts (chỉ reactions cần helper, còn lại dùng _count)
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

    res.json({
      success: true,
      items: itemsWithReactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Error fetching saved posts:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy bài viết đã lưu!' });
  }
};

export const getUserPostsPreview = async (req, res) => {
  try {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user?.id || null;
    const { page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, privacySettings: { select: { isPrivate: true } } }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại!' });
    }

    const isSelf = targetUserId === currentUserId;
    const isPrivateAccount = targetUser.privacySettings?.isPrivate;

    if (!isSelf && isPrivateAccount) {
      if (!currentUserId) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản này là riêng tư. Bạn cần đăng nhập và theo dõi để xem bài viết!'
        });
      }

      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId
          }
        }
      });

      if (!isFollowing) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản này là riêng tư. Bạn cần theo dõi để xem bài viết!'
        });
      }
    }

    const whereClause = { userId: targetUserId, deletedAt: null };

    if (!isSelf && currentUserId) {
      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId
          }
        }
      });
      whereClause.whoCanSee = isFollowing ? { in: ['everyone', 'followers'] } : 'everyone';
    } else if (!isSelf) {
      whereClause.whoCanSee = 'everyone';
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      select: {
        id: true,
        media: { take: 1, select: { mediaUrl: true, mediaType: true } },
        _count: { select: { comments: true, reposts: true, savedPosts: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const postIds = posts.map(p => p.id);
    
    // Lấy reaction counts cho posts (chỉ reactions cần helper, còn lại dùng _count)
    const reactionCountMap = await getReactionCounts(postIds, 'POST');

    const postsWithCounts = posts.map(post => ({
      id: post.id,
      previewImage: post.media[0]?.mediaUrl || null,
      previewMediaType: post.media[0]?.mediaType || null,
      reactionCount: reactionCountMap[post.id] || 0,
      commentCount: post._count.comments || 0,
      repostsCount: post._count.reposts || 0,
      savesCount: post._count.savedPosts || 0
    }));

    res.json({
      success: true,
      posts: postsWithCounts,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getUserPostsPreview:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy bài viết!' });
  }
};

// POST /api/user/posts/:postId/view - Đánh dấu post đã xem
export const markPostAsViewed = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Validate postId
    const parsedPostId = parseInt(postId);
    if (!postId || isNaN(parsedPostId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    // Kiểm tra post có tồn tại không
    const post = await prisma.post.findUnique({
      where: { id: parsedPostId },
      select: { id: true, deletedAt: true }
    });

    if (!post || post.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại'
      });
    }

    // Upsert post view (nếu đã xem rồi thì chỉ update viewedAt)
    await prisma.postView.upsert({
      where: {
        postId_userId: {
          postId: parsedPostId,
          userId: userId
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        postId: parsedPostId,
        userId: userId,
        viewedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Đã đánh dấu bài viết đã xem'
    });
  } catch (error) {
    console.error('Error marking post as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu bài viết đã xem'
    });
  }
};

// GET /api/user/posts/feed - Lấy feed posts (từ users đang follow + chính mình)
export const getFeedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy danh sách user IDs mà current user đang follow
    const followingUsers = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });

    const followingUserIds = followingUsers.map(f => f.followingId);
    // Bao gồm cả chính user để hiển thị posts của mình
    const allowedUserIds = [...followingUserIds, userId];

    if (allowedUserIds.length === 0) {
      return res.json({
        success: true,
        posts: [],
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      });
    }

    // Query posts với điều kiện:
    // - User là người đang follow HOẶC chính mình
    // - Post không bị xóa
    // - Kiểm tra privacy settings (whoCanSee)
    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        OR: [
          // Posts của chính mình: hiển thị tất cả
          { userId: userId },
          // Posts của người đang follow: chỉ hiển thị nếu whoCanSee là 'everyone' hoặc 'followers'
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
    });

    // Query reposts từ những user đang follow + chính mình
    const reposts = await prisma.repost.findMany({
      where: {
        deletedAt: null,
        userId: { in: allowedUserIds },
        post: {
          deletedAt: null,
          OR: [
            // Post gốc của chính mình: hiển thị tất cả
            { userId: userId },
            // Post gốc của người đang follow: chỉ hiển thị nếu whoCanSee là 'everyone' hoặc 'followers'
            {
              userId: { in: followingUserIds },
              whoCanSee: { in: ['everyone', 'followers'] }
            }
          ]
        }
      },
      include: {
        user: { // người repost
          select: userSelectFields
        },
        post: { // bài viết gốc
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
            comments: true // Comments của repost
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Lấy tất cả post IDs (từ posts và reposts)
    const allPostIds = [
      ...posts.map(p => p.id),
      ...reposts.map(r => r.post.id)
    ];

    // Lấy tất cả repost IDs
    const allRepostIds = reposts.map(r => r.id);

    // Lấy reaction counts cho posts và reposts song song (chỉ reactions cần helper, còn lại dùng _count)
    const [postReactionCountMap, repostReactionCountMap] = await Promise.all([
      getReactionCounts(allPostIds, 'POST'),
      getReactionCounts(allRepostIds, 'REPOST')
    ]);

    // Lấy my reactions để check xem current user đã like post nào chưa
    const myPostReactions = await prisma.reaction.findMany({
      where: {
        userId: userId,
        targetId: { in: allPostIds },
        targetType: 'POST'
      },
      select: {
        targetId: true
      }
    });

    const myReactionPostIds = new Set(myPostReactions.map(r => r.targetId));

    // Lấy my reactions để check xem current user đã like repost nào chưa
    const myRepostReactions = await prisma.reaction.findMany({
      where: {
        userId: userId,
        targetId: { in: allRepostIds },
        targetType: 'REPOST'
      },
      select: {
        targetId: true
      }
    });

    const myReactionRepostIds = new Set(myRepostReactions.map(r => r.targetId));

    // Lấy my saved posts để check xem current user đã save post nào chưa
    const mySavedPosts = await prisma.savedPost.findMany({
      where: {
        userId: userId,
        postId: { in: allPostIds }
      },
      select: {
        postId: true
      }
    });

    const mySavedPostIds = new Set(mySavedPosts.map(s => s.postId));

    // Lấy my reposts để check xem current user đã repost post nào chưa
    const myReposts = await prisma.repost.findMany({
      where: {
        userId: userId,
        postId: { in: allPostIds },
        deletedAt: null
      },
      select: {
        postId: true
      }
    });

    const myRepostedPostIds = new Set(myReposts.map(r => r.postId));

    // Lấy danh sách post IDs đã xem để filter khỏi feed (chỉ lấy records có postId, không phải repostId)
    const viewedPosts = await prisma.postView.findMany({
      where: {
        userId: userId,
        postId: { in: allPostIds, not: null }
      },
      select: {
        postId: true
      }
    });

    const viewedPostIds = new Set(viewedPosts.map(v => v.postId).filter(Boolean));

    // Lấy danh sách repost IDs đã xem để filter khỏi feed (chỉ lấy records có repostId, không phải postId)
    const viewedReposts = await prisma.postView.findMany({
      where: {
        userId: userId,
        repostId: { in: allRepostIds, not: null }
      },
      select: {
        repostId: true
      }
    });

    const viewedRepostIds = new Set(viewedReposts.map(v => v.repostId).filter(Boolean));

    // Format posts để trả về (chỉ lấy posts chưa xem)
    const postsWithCounts = posts
      .filter(post => !viewedPostIds.has(post.id)) // Filter bài viết đã xem
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
        commentCount: post._count.comments || 0,
        repostsCount: post._count.reposts || 0,
        savesCount: post._count.savedPosts || 0,
        whoCanSee: post.whoCanSee,
        whoCanComment: post.whoCanComment,
        isLiked: myReactionPostIds.has(post.id),
        isSaved: mySavedPostIds.has(post.id),
        isReposted: myRepostedPostIds.has(post.id)
      }));

    // Format reposts để trả về (chỉ lấy reposts chưa xem )
    const repostsWithCounts = reposts
      .filter(repost => !viewedRepostIds.has(repost.id)) // Filter reposts đã xem dựa trên repostId
      .map(repost => ({
        id: repost.post.id, // Post ID gốc để hiển thị nội dung
        repostId: repost.id, // Repost ID để query reactions/comments
        userId: repost.post.userId,
        content: repost.post.content,
        createdAt: repost.createdAt, // Dùng createdAt của repost để sort
        originalCreatedAt: repost.post.createdAt, // Thời gian của bài gốc
        updatedAt: repost.post.updatedAt,
        user: repost.post.user, // User của post gốc
        repostedBy: repost.user, // User đã repost
        repostContent: repost.content, // Nội dung comment khi repost
        media: repost.post.media,
        previewImage: repost.post.media[0]?.mediaUrl || null,
        previewMediaType: repost.post.media[0]?.mediaType || null,
        reactionCount: repostReactionCountMap[repost.id] || 0, // Reactions của repost
        commentCount: repost._count.comments || 0, // Comments của repost (lấy từ _count)
        // Stats của bài gốc
        originalReactionCount: postReactionCountMap[repost.post.id] || 0,
        originalCommentCount: repost.post._count.comments || 0,
        originalRepostsCount: repost.post._count.reposts || 0,
        originalSavesCount: repost.post._count.savedPosts || 0,
        // Trạng thái tương tác của bài gốc
        originalIsLiked: myReactionPostIds.has(repost.post.id),
        originalIsSaved: mySavedPostIds.has(repost.post.id),
        originalIsReposted: myRepostedPostIds.has(repost.post.id),
        whoCanSee: repost.post.whoCanSee,
        whoCanComment: repost.post.whoCanComment,
        isLiked: myReactionRepostIds.has(repost.id), // Check like repost, không phải post gốc
        isSaved: mySavedPostIds.has(repost.post.id),
        isReposted: myRepostedPostIds.has(repost.post.id),
        isRepost: true // Flag để biết đây là repost
      }));

    // Merge posts và reposts, sort theo createdAt
    const allFeedItems = [...postsWithCounts, ...repostsWithCounts].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Paginate kết quả đã merge
    const paginatedItems = allFeedItems.slice(skip, skip + parseInt(limit));

    // Đếm tổng số items (posts + reposts)
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

    res.json({
      success: true,
      posts: paginatedItems,
      page: parseInt(page),
      limit: parseInt(limit),
      total
    });
  } catch (error) {
    console.error('Error getting feed posts:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy feed!'
    });
  }
};

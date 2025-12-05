import prisma from "../../utils/prisma.js";
import { getReactionCounts } from "../../utils/postStatsHelper.js";
import { isFollowing } from "../../services/followService.js";
import { 
  createPostService, 
  updatePostService, 
  userSelectFields,
  checkPostAccess,
  checkUserPostsAccess,
  getSavedPostsService,
  getFeedPostsService
} from "../../services/postService.js";

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

    // Tạo post bằng service
    const completePost = await createPostService({
      userId,
      content,
      mediaUrls,
      privacySettings
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

    // Kiểm tra quyền truy cập dựa trên privacy settings bằng service
    const accessCheck = await checkPostAccess({
      post,
      currentUserId,
      postOwnerId: post.userId
    });

    if (!accessCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: accessCheck.message
      });
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

    // Cập nhật post bằng service
    const completePost = await updatePostService({
      postId: Number(postId),
      userId,
      content,
      mediaUrls,
      privacySettings
    });

    // Lấy reaction count
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
    
    // Xử lý error từ service
    if (error.message === 'Bài viết không tồn tại hoặc không thuộc về bạn!') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

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

    // Lấy saved posts bằng service
    const { items: itemsWithReactions, total } = await getSavedPostsService({
      userId: targetUserId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

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

    // Kiểm tra quyền xem posts của user bằng service
    const accessCheck = await checkUserPostsAccess({
      currentUserId,
      targetUserId
    });

    if (!accessCheck.allowed) {
      const statusCode = accessCheck.message.includes('không tồn tại') ? 404 : 403;
      return res.status(statusCode).json({
        success: false,
        message: accessCheck.message
      });
    }

    const isSelf = targetUserId === currentUserId;

    const whereClause = { userId: targetUserId, deletedAt: null };

    if (!isSelf && currentUserId) {
      const isFollowingUser = await isFollowing(currentUserId, targetUserId);
      whereClause.whoCanSee = isFollowingUser ? { in: ['everyone', 'followers'] } : 'everyone';
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
    
    // Lấy reaction counts và reposts counts cho posts
    const [reactionCountMap, repostsCountMap] = await Promise.all([
      getReactionCounts(postIds, 'POST'),
      // Đếm số lượng reposts với deletedAt: null cho mỗi post
      prisma.repost.groupBy({
        by: ['postId'],
        where: {
          postId: { in: postIds },
          deletedAt: null
        },
        _count: {
          id: true
        }
      })
    ]);

    // Tạo map repostsCount: postId -> count (chỉ đếm reposts chưa xóa)
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
      repostsCount: repostsCountByPostId[post.id] || 0, // Chỉ đếm reposts chưa xóa (deletedAt: null)
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

    // Lấy feed posts bằng service
    const result = await getFeedPostsService({
      userId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting feed posts:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy feed!'
    });
  }
};

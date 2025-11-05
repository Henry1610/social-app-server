import prisma from "../../utils/prisma.js";
import { getReactionCounts } from "../../utils/postStatsHelper.js";

// Helper: User select fields (dùng chung cho nhiều queries)
const userSelectFields = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true
};

/**
 * GET /api/user/:username/reposts
 * Lấy danh sách reposts của một user
 * Chỉ cho phép xem reposts của chính mình
 */
export const getUserRepostsReview = async (req, res) => {
  const targetUserId = Number(req.resolvedUserId);
  const currentUserId = req.user?.id || null;

  // Chỉ cho phép xem reposts của chính mình
  if (!currentUserId || targetUserId !== currentUserId) {
    return res.status(403).json({
      success: false,
      message: 'Bạn chỉ có thể xem bài viết đã đăng lại của chính mình!'
    });
  }

  try {
    const reposts = await prisma.repost.findMany({
      where: { 
        userId: targetUserId,
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { // người repost
          select: userSelectFields
        },
        post: { // bài viết gốc
          include: {
            user: { // người đăng bài gốc
              select: userSelectFields
            },
            media: true,
            _count: { select: { comments: true, reposts: true, savedPosts: true } }
          }
        },
        _count: {
          select: {
            comments: true // Comments của repost
          }
        }
      }
    });

    // Lấy tất cả repost IDs và post IDs
    const repostIds = reposts.map(r => r.id);
    const postIds = reposts.map(r => r.post.id);
    
    // Lấy reaction counts cho reposts và posts gốc song song (chỉ reactions cần helper, còn lại dùng _count)
    const [repostReactionCountMap, postReactionCountMap] = await Promise.all([
      getReactionCounts(repostIds, 'REPOST'),
      getReactionCounts(postIds, 'POST')
    ]);

    // Lấy trạng thái tương tác của user cho posts gốc
    const [myPostReactions, mySavedPosts, myRepostedPosts] = await Promise.all([
      prisma.reaction.findMany({
        where: {
          userId: targetUserId,
          targetId: { in: postIds },
          targetType: 'POST'
        },
        select: { targetId: true }
      }),
      prisma.savedPost.findMany({
        where: {
          userId: targetUserId,
          postId: { in: postIds }
        },
        select: { postId: true }
      }),
      prisma.repost.findMany({
        where: {
          userId: targetUserId,
          postId: { in: postIds },
          deletedAt: null
        },
        select: { postId: true }
      })
    ]);

    const myReactionPostIds = new Set(myPostReactions.map(r => r.targetId));
    const mySavedPostIds = new Set(mySavedPosts.map(s => s.postId));
    const myRepostedPostIds = new Set(myRepostedPosts.map(r => r.postId));

    // Format dữ liệu: thêm reaction và comment counts cho repost
    const repostsWithCounts = reposts.map(repost => ({
      ...repost,
      reactionCount: repostReactionCountMap[repost.id] || 0, // Reactions của repost
      commentCount: repost._count.comments || 0, // Comments của repost (lấy từ _count)
      post: {
        ...repost.post,
        _count: {
          ...repost.post._count,
          reactions: postReactionCountMap[repost.post.id] || 0, // Reactions của post gốc
          // comments và reposts đã có trong _count từ Prisma query
        },
        // Thêm stats của bài gốc vào response
        originalReactionCount: postReactionCountMap[repost.post.id] || 0,
        originalCommentCount: repost.post._count.comments || 0,
        originalRepostsCount: repost.post._count.reposts || 0,
        originalSavesCount: repost.post._count.savedPosts || 0,
        // Thêm thời gian của bài gốc
        originalCreatedAt: repost.post.createdAt,
      },
      // Thêm trạng thái tương tác của bài gốc
      originalIsLiked: myReactionPostIds.has(repost.post.id),
      originalIsSaved: mySavedPostIds.has(repost.post.id),
      originalIsReposted: myRepostedPostIds.has(repost.post.id),
    }));

    res.json({ success: true, reposts: repostsWithCounts });
  } catch (error) {
    console.error('Error getAllRePosts:', error);
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
};

// POST /api/user/reposts/:postId
export const repostPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content = '' } = req.body;
    const userId = req.user.id;

    // Check if original post exists
    const originalPost = await prisma.post.findUnique({
      where: { id: Number(postId) },
    });

    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết gốc không tồn tại!'
      });
    }

    // Upsert repost (tạo mới hoặc phục hồi nếu đã xóa mềm)
    const repost = await prisma.repost.upsert({
      where: {
        userId_postId: {  // tên composite key tự sinh từ @@id([userId, postId])
          userId,
          postId: Number(postId)
        }
      },
      update: { deletedAt: null, content, createdAt: new Date() }, // phục hồi nếu trước đó đã xóa mềm
      create: {
        userId,
        postId: Number(postId),
        content,
        createdAt: new Date(),
      },
    });
    

    // Tạo notification cho tác giả bài gốc (chỉ khi không phải chính mình)
    if (originalPost.userId !== userId) {
    await prisma.notification.create({
      data: {
        userId: originalPost.userId,
        actorId: userId,
          type: 'REPOST',
          targetType: 'POST',
        targetId: Number(postId),
        createdAt: new Date(),
      },
    });
    }

    res.json({
      success: true,
      message: 'Repost thành công!',
      repost
    });
  } catch (error) {
    console.error('Error reposting:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi repost!'
    });
  }
};

// DELETE /api/user/reposts/:postId
export const undoRepost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const result = await prisma.$transaction(async (prisma) => {
      // Tìm repost chưa xóa
      const repost = await prisma.repost.findFirst({
        where: { userId, postId: Number(postId), deletedAt: null },
      });

      if (!repost) return null;

      // Xóa mềm
      await prisma.repost.update({
        where: { id: repost.id },
        data: { deletedAt: new Date() },
      });

      // Đếm repost còn lại
      const repostCount = await prisma.repost.count({
        where: { postId: Number(postId), deletedAt: null },
      });

      return repostCount;
    });
    if (result === null) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa repost bài viết này!",
      });
    }
    res.json({
      success: true,
      message: 'Hủy repost thành công!',
      repostCount: result,
    });
  } catch (error) {
    console.error('Error undoing repost:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi hủy repost!'
    });
  }
};

// POST /api/user/reposts/:repostId/view - Đánh dấu repost đã xem
export const markRepostAsViewed = async (req, res) => {
  try {
    const { repostId } = req.params;
    const userId = req.user.id;

    // Validate repostId
    const parsedRepostId = parseInt(repostId);
    if (!repostId || isNaN(parsedRepostId)) {
      return res.status(400).json({
        success: false,
        message: 'ID repost không hợp lệ'
      });
    }

    // Kiểm tra repost có tồn tại không
    const repost = await prisma.repost.findUnique({
      where: { id: parsedRepostId },
      select: { id: true, deletedAt: true }
    });

    if (!repost || repost.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Repost không tồn tại'
      });
    }

    // Upsert repost view (nếu đã xem rồi thì chỉ update viewedAt)
    await prisma.postView.upsert({
      where: {
        repostId_userId: {
          repostId: parsedRepostId,
          userId: userId
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        repostId: parsedRepostId,
        userId: userId,
        viewedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Đã đánh dấu repost đã xem'
    });
  } catch (error) {
    console.error('Error marking repost as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu repost đã xem'
    });
  }
};


import prisma from "../../utils/prisma.js";
import { getReactionCounts } from "../../utils/postStatsHelper.js";
import { isFollowing } from "../../services/followService.js";

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
 * Cho phép xem reposts của người khác (với kiểm tra privacy settings)
 */
export const getUserReposts = async (req, res) => {
  const targetUserId = Number(req.resolvedUserId);
  const currentUserId = req.user?.id ? Number(req.user.id) : null;

  try {
    // Kiểm tra privacy settings của tài khoản repost
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, privacySettings: { select: { isPrivate: true } } }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại!' });
    }

    const isSelf = targetUserId === currentUserId;
    const isPrivateAccount = targetUser.privacySettings?.isPrivate;

    // Kiểm tra follow relationship (chỉ query một lần)
    let isFollowingTargetUser = false;
    if (!isSelf && currentUserId) {
      isFollowingTargetUser = await isFollowing(currentUserId, targetUserId);
    }

    // Kiểm tra quyền truy cập: nếu tài khoản riêng tư và không phải chính mình
    if (!isSelf && isPrivateAccount) {
      if (!currentUserId) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản này là riêng tư. Bạn cần đăng nhập và theo dõi để xem bài viết đã đăng lại!'
        });
      }

      if (!isFollowingTargetUser) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản này là riêng tư. Bạn cần theo dõi để xem bài viết đã đăng lại!'
        });
      }
    }

    // Lấy tất cả reposts (kể cả khi post gốc bị xóa hoặc bị ẩn)
    const reposts = await prisma.repost.findMany({
      where: { 
        userId: targetUserId,
        deletedAt: null,
        // Không filter post gốc để vẫn hiển thị repost khi post gốc bị xóa hoặc bị ẩn
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { // người repost (chính là targetUserId)
          select: userSelectFields
        },
        post: { // bài viết gốc (có thể null nếu bị xóa)
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

    // Nếu không có repost nào, trả về mảng rỗng
    if (reposts.length === 0) {
      return res.json({ success: true, reposts: [] });
    }

    // Lấy tất cả repost IDs và post IDs (chỉ lấy post IDs hợp lệ)
    const repostIds = reposts.map(r => r.id);
    const postIds = reposts
      .filter(r => r.post && !r.post.deletedAt)
      .map(r => r.post.id);
    
    // Kiểm tra quyền xem post gốc cho từng repost
    const canViewOriginalPost = new Map();
    for (const repost of reposts) {
      if (!repost.post) {
        // Post gốc không tồn tại
        canViewOriginalPost.set(repost.id, false);
        continue;
      }
      
      if (repost.post.deletedAt) {
        // Post gốc bị xóa
        canViewOriginalPost.set(repost.id, false);
        continue;
      }
      
      const postWhoCanSee = repost.post.whoCanSee || 'everyone';
      const isPostOwner = repost.post.userId === currentUserId;
      
      // Nếu là chủ post gốc, luôn xem được
      if (isPostOwner) {
        canViewOriginalPost.set(repost.id, true);
        continue;
      }
      
      // Nếu post gốc có whoCanSee = 'nobody', không xem được
      if (postWhoCanSee === 'nobody') {
        canViewOriginalPost.set(repost.id, false);
        continue;
      }
      
      // Nếu là chính mình (người repost), xem được (trừ 'nobody' đã check ở trên)
      if (isSelf) {
        canViewOriginalPost.set(repost.id, true);
        continue;
      }
      
      // Kiểm tra privacy settings
      if (postWhoCanSee === 'followers') {
        canViewOriginalPost.set(repost.id, isFollowingTargetUser);
      } else {
        // 'everyone'
        canViewOriginalPost.set(repost.id, true);
      }
    }
    
    // Lấy tất cả dữ liệu cần thiết song song để tối ưu performance
    const [
      repostReactionCountMap,
      postReactionCountMap,
      myPostReactions,
      mySavedPosts,
      myRepostedPosts,
      myRepostReactions,
      repostsCountMap
    ] = await Promise.all([
      // Reaction counts cho reposts và posts gốc
      getReactionCounts(repostIds, 'REPOST'),
      getReactionCounts(postIds, 'POST'),
      // Trạng thái tương tác của người đang xem (currentUserId) với posts gốc
      currentUserId ? prisma.reaction.findMany({
        where: {
          userId: currentUserId,
          targetId: { in: postIds },
          targetType: 'POST'
        },
        select: { targetId: true }
      }) : Promise.resolve([]),
      currentUserId ? prisma.savedPost.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds }
        },
        select: { postId: true }
      }) : Promise.resolve([]),
      currentUserId ? prisma.repost.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          deletedAt: null
        },
        select: { postId: true }
      }) : Promise.resolve([]),
      // Trạng thái tương tác của người đang xem (currentUserId) với chính reposts
      currentUserId ? prisma.reaction.findMany({
        where: {
          userId: currentUserId,
          targetId: { in: repostIds },
          targetType: 'REPOST'
        },
        select: { targetId: true }
      }) : Promise.resolve([]),
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

    // Chuyển đổi thành Set để lookup nhanh hơn
    const myReactionPostIds = new Set(myPostReactions.map(r => r.targetId));
    const mySavedPostIds = new Set(mySavedPosts.map(s => s.postId));
    const myRepostedPostIds = new Set(myRepostedPosts.map(r => r.postId));
    const myReactionRepostIds = new Set(myRepostReactions.map(r => r.targetId));
    
    // Tạo map repostsCount: postId -> count (chỉ đếm reposts chưa xóa)
    const repostsCountByPostId = {};
    repostsCountMap.forEach(item => {
      repostsCountByPostId[item.postId] = item._count.id;
    });

    // Format dữ liệu response
    const repostsWithCounts = reposts.map(repost => {
      const canView = canViewOriginalPost.get(repost.id) || false;
      const isOriginalPostDeleted = !repost.post || repost.post.deletedAt;
      const isOriginalPostHidden = !canView;
      
      return {
        id: repost.id,
        content: repost.content,
        createdAt: repost.createdAt,
        userId: repost.userId,
        postId: repost.postId,
        // Thông tin người repost
        user: repost.user,
        // Stats của repost
        reactionCount: repostReactionCountMap[repost.id] || 0,
        commentCount: repost._count.comments || 0,
        // Trạng thái tương tác của user với repost
        isLiked: myReactionRepostIds.has(repost.id),
        // Lưu ý: isSaved và isReposted check trên post gốc (vì savedPost/repost lưu postId, không phải repostId)
        isSaved: repost.post && canView ? mySavedPostIds.has(repost.post.id) : false,
        isReposted: repost.post && canView ? myRepostedPostIds.has(repost.post.id) : false,
        // Thông tin bài gốc
        post: (isOriginalPostDeleted || isOriginalPostHidden) ? null : {
          ...repost.post,
          _count: {
            ...repost.post._count,
            reactions: postReactionCountMap[repost.post.id] || 0,
          },
          // Stats của bài gốc (để frontend dễ sử dụng)
          originalReactionCount: postReactionCountMap[repost.post.id] || 0,
          originalCommentCount: repost.post._count.comments || 0,
          originalRepostsCount: repostsCountByPostId[repost.post.id] || 0, // Chỉ đếm reposts chưa xóa (deletedAt: null)
          originalSavesCount: repost.post._count.savedPosts || 0,
          originalCreatedAt: repost.post.createdAt,
          // Trạng thái tương tác của user với bài gốc
          originalIsLiked: myReactionPostIds.has(repost.post.id),
          originalIsSaved: mySavedPostIds.has(repost.post.id),
          originalIsReposted: myRepostedPostIds.has(repost.post.id),
        },
        // Đánh dấu post gốc bị xóa hoặc bị ẩn
        isOriginalPostDeleted: isOriginalPostDeleted || isOriginalPostHidden,
      };
    });

    res.json({ success: true, reposts: repostsWithCounts });
  } catch (error) {
    console.error('Error getUserReposts:', error);
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


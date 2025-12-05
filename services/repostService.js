import prisma from "../utils/prisma.js";
import { getReactionCounts } from "../utils/postStatsHelper.js";
import { isFollowing } from "./followService.js";

// Helper: User select fields (dùng chung cho nhiều queries)
const userSelectFields = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true
};

/**
 * Custom error class cho repost service
 */
class RepostServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'RepostServiceError';
  }
}

/**
 * Lấy danh sách reposts của một user
 * @param {number} targetUserId - ID của user cần lấy reposts
 * @param {number} currentUserId - ID của user đang xem (luôn có vì route yêu cầu authenticate)
 * @returns {Promise<Array>} Mảng các reposts đã được format
 * @throws {RepostServiceError} Nếu có lỗi xảy ra
 */
export const getUserReposts = async (targetUserId, currentUserId) => {
  try {
    // Kiểm tra privacy settings của tài khoản repost
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, privacySettings: { select: { isPrivate: true } } }
    });

    if (!targetUser) {
      throw new RepostServiceError('Người dùng không tồn tại!', 404);
    }

    const isSelf = targetUserId === currentUserId;
    const isPrivateAccount = targetUser.privacySettings?.isPrivate;

    // Kiểm tra follow relationship (chỉ query một lần)
    // currentUserId luôn có vì route yêu cầu authenticate
    let isFollowingTargetUser = false;
    if (!isSelf) {
      isFollowingTargetUser = await isFollowing(currentUserId, targetUserId);
    }

    // Kiểm tra quyền truy cập: nếu tài khoản riêng tư và không phải chính mình
    // Phải follow mới được xem (currentUserId luôn có vì route yêu cầu authenticate)
    if (!isSelf && isPrivateAccount && !isFollowingTargetUser) {
      throw new RepostServiceError(
        'Tài khoản này là riêng tư. Bạn cần theo dõi để xem bài viết đã đăng lại!',
        403
      );
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
      return [];
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
      // currentUserId luôn có vì route yêu cầu authenticate
      prisma.reaction.findMany({
        where: {
          userId: currentUserId,
          targetId: { in: postIds },
          targetType: 'POST'
        },
        select: { targetId: true }
      }),
      prisma.savedPost.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds }
        },
        select: { postId: true }
      }),
      prisma.repost.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          deletedAt: null
        },
        select: { postId: true }
      }),
      // Trạng thái tương tác của người đang xem (currentUserId) với chính reposts
      prisma.reaction.findMany({
        where: {
          userId: currentUserId,
          targetId: { in: repostIds },
          targetType: 'REPOST'
        },
        select: { targetId: true }
      }),
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

    return repostsWithCounts;
  } catch (error) {
    // Nếu là RepostServiceError thì throw lại
    if (error instanceof RepostServiceError) {
      throw error;
    }
    // Nếu là lỗi khác thì wrap thành RepostServiceError
    console.error('Error getUserReposts service:', error);
    throw new RepostServiceError('Lỗi server!', 500);
  }
};


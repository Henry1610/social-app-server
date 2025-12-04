import prisma from "../utils/prisma.js";
import { 
  updateFollowCacheAtomic
} from "./redis/followService.js";
import { getUserById } from "./userService.js";
import { followEvents } from "../socket/events/followEvents.js";
// Tạo follow
export const createFollow = async (followerId, followingId) => {
  return await prisma.follow.upsert({
    where: {
      followerId_followingId: { // composite key
        followerId,
        followingId
      }
    },
    update: {}, // nếu đã tồn tại thì không update gì cả
    create: {
      followerId,
      followingId
    }
  });
};

// Xóa follow
export const deleteFollow = async (followerId, followingId) => {
  return await prisma.follow.delete({
    where: { followerId_followingId: { followerId, followingId } }
  });
};

// Kiểm tra đã follow chưa
export const isFollowing = async (followerId, followingId) => {
  const record = await prisma.follow.findFirst({
    where: { followerId, followingId },
    select: { followerId: true, followingId: true }
  });
  return !!record;
};

// Lấy danh sách follower của 1 user 
export const getFollowersByUserId = async (userId) => {
  return prisma.follow.findMany({
    where: { followingId: userId },
    select: {
      follower: {
        select: { id: true, username: true, fullName: true, avatarUrl: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// Lấy danh sách following của 1 user 
export const getFollowingByUserId = async (userId) => {
  return prisma.follow.findMany({
    where: { followerId: userId },
    select: {
      following: {
        select: { id: true, username: true, fullName: true, avatarUrl: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// Tạo follow request (cho tài khoản private)
export const createFollowRequest = async (fromUserId, toUserId) => {
  return await prisma.followRequest.create({
    data: { fromUserId, toUserId }
  });
};

// Xóa follow request
export const deleteFollowRequest = async (followerId, followingId) => {
  return await prisma.followRequest.delete({
    where: {
      fromUserId_toUserId: {
        fromUserId: followerId,
        toUserId: followingId
      }
    }
  });
};

// Kiểm tra đã gửi follow request chưa
export const hasFollowRequest = async (fromUserId, toUserId) => {
  const record = await prisma.followRequest.findFirst({
    where: {
      fromUserId,
      toUserId,
    },
    select: { id: true }
  });
  return !!record;
};
//-----------------------------------------------------Main service-----------------------------------------------------

// Chấp nhận follow request
export const acceptFollowRequestService = async (currentUserId, targetUserId) => {
  // Tạo follow
  const follow = await createFollow(targetUserId, currentUserId);
  // Sử dụng atomic operation để cập nhật cache và count cùng lúc
  await updateFollowCacheAtomic(targetUserId, currentUserId, 'follow');
  // Xóa follow request
  await deleteFollowRequest(targetUserId, currentUserId);
  const actor = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { id: true, username: true, fullName: true, avatarUrl: true }
  });
  // Emit realtime event
  followEvents.emit("follow_request_accepted", { actor, targetUserId });
  return {
    success: true,
    message: "Đã chấp nhận yêu cầu theo dõi.",
  };
};

// Từ chối follow request
export const rejectFollowRequestService = async (targetUserId, currentUserId) => {
  // Xóa follow request
  await deleteFollowRequest(targetUserId, currentUserId);
  
  // Lấy thông tin actor (người từ chối)
  const actor = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { id: true, username: true, fullName: true, avatarUrl: true }
  });
  
  // Emit realtime event
  followEvents.emit("follow_request_rejected", { actor, targetUserId });
  
  return {
    success: true,
    message: "Đã từ chối yêu cầu theo dõi."
  };
};

// Service function chung cho follow user
export const followUserService = async (userId, followingId) => {
  try {
    if (userId === followingId) return { success: false, message: "Không thể follow chính mình!" };
    const targetUser = await getUserById(followingId, "Người dùng không tồn tại!");

    if (await isFollowing(userId, followingId)) return { success: false, message: "Bạn đã theo dõi người dùng này!" };

    const isPrivate = !!targetUser?.privacySettings?.isPrivate;

    if (isPrivate) {
      if (await hasFollowRequest(userId, followingId)) {
        return { success: false, message: "Bạn đã gửi yêu cầu theo dõi rồi!" };
      }

      await createFollowRequest(userId, followingId);

      return { success: true, message: "Yêu cầu theo dõi đã gửi!", type: "follow_request", targetUser };
    } else {
      await createFollow(userId, followingId);
      // Sử dụng atomic operation để cập nhật cache và count cùng lúc
      await updateFollowCacheAtomic(userId, followingId, 'follow');

      return { success: true, message: "Bạn đã theo dõi người dùng!", type: "follow", targetUser };
    }
  } catch (error) {
    console.error("Error in followUserService:", error);
    return { success: false, message: "Lỗi server khi follow user!" };
  }
};

// Service function chung cho unfollow user
export const unfollowUserService = async (userId, followingId) => {
  try {
    // Kiểm tra đã follow chưa
    const alreadyFollowing = await isFollowing(userId, Number(followingId));
    if (!alreadyFollowing) {
      return { success: false, message: "Bạn chưa theo dõi người dùng này!" };
    }

    // Business logic
    await deleteFollow(userId, Number(followingId));
    // Sử dụng atomic operation để cập nhật cache và count cùng lúc
    await updateFollowCacheAtomic(userId, Number(followingId), 'unfollow');

    await prisma.followRequest.deleteMany({
      where: {
        fromUserId: userId,
        toUserId: followingId,
      },
    });

    return { success: true, message: "Bạn đã hủy theo dõi người dùng!" };
  } catch (error) {
    console.error('Error in unfollowUserService:', error);
    return { success: false, message: "Lỗi server khi unfollow user!" };
  }
};

export const removeFollowerService = async (followerId, followingId) => {
  try {
    if (followerId === followingId) return { success: false, message: "Không thể xóa chính mình!" };
    
    // Kiểm tra người dùng có tồn tại không
    const targetUser = await getUserById(followingId, "Người dùng không tồn tại!");
    
    // Kiểm tra đã follow chưa
    const alreadyFollowing = await isFollowing(followerId, Number(followingId));
    if (!alreadyFollowing) {
      return { success: false, message: "Người dùng này chưa theo dõi bạn!" };
    }

    await deleteFollow(followerId, Number(followingId));
    // Sử dụng atomic operation để cập nhật cache và count cùng lúc
    await updateFollowCacheAtomic(followerId, Number(followingId), 'unfollow');

    return { success: true, message: "Đã xóa người theo dõi!" };
  } catch (error) {
    console.error('Error in removeFollowerService:', error);
    return { success: false, message: "Lỗi server khi xóa người theo dõi!" };
  }
};

/**
 * Lấy danh sách follow requests của user
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Danh sách follow requests
 */
export const getFollowRequestsList = async (userId) => {
  return await prisma.followRequest.findMany({
    where: { toUserId: userId },
    select: {
      id: true,
      fromUser: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      },
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Kiểm tra và lấy follow request
 * @param {number} fromUserId - ID của người gửi request
 * @param {number} toUserId - ID của người nhận request
 * @returns {Promise<Object|null>} Follow request object hoặc null
 */
export const findFollowRequest = async (fromUserId, toUserId) => {
  return await prisma.followRequest.findUnique({
    where: {
      fromUserId_toUserId: {
        fromUserId,
        toUserId
      }
    },
    select: { id: true }
  });
};

/**
 * Kiểm tra quyền xem followers/followings dựa trên privacy settings
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @param {Object} user - User object với privacySettings
 * @returns {Promise<boolean>} true nếu có quyền xem
 */
export const canViewFollowList = async (currentUserId, targetUserId, user) => {
  // Nếu xem chính mình thì luôn được
  if (currentUserId === targetUserId) {
    return true;
  }

  // Nếu tài khoản public thì ai cũng xem được
  if (!user?.privacySettings?.isPrivate) {
    return true;
  }

  // Nếu tài khoản private, kiểm tra xem có đang follow không
  return await isFollowing(currentUserId, targetUserId);
};

/**
 * Lấy follow status của user
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Follow status object
 */
export const getFollowStatusService = async (currentUserId, targetUserId) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      privacySettings: {
        select: { isPrivate: true }
      }
    }
  });

  if (!user) {
    return null;
  }

  if (user.id === currentUserId) {
    // Nếu đang xem profile của chính mình
    const incomingFollowRequests = await prisma.followRequest.findMany({
      where: { toUserId: currentUserId },
      include: {
        fromUser: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        }
      }
    });

    return {
      isSelf: true,
      isFollowing: false,
      incomingRequests: incomingFollowRequests
    };
  }

  // Kiểm tra các trạng thái follow
  const [isFollowingUser, isFollower, followRequest, incomingFollowRequest] = await Promise.all([
    isFollowing(currentUserId, user.id),
    isFollowing(user.id, currentUserId),
    findFollowRequest(currentUserId, user.id),
    findFollowRequest(user.id, currentUserId)
  ]);

  return {
    isSelf: false,
    isPrivate: user.privacySettings?.isPrivate || false,
    isFollowing: isFollowingUser,
    isPending: !!followRequest,
    isFollower: isFollower,
    hasIncomingRequest: !!incomingFollowRequest
  };
};

/**
 * Lấy danh sách người bạn follow cũng đang follow target user
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Array>} Danh sách users
 */
export const getAlsoFollowingService = async (currentUserId, targetUserId) => {
  // Lấy danh sách người currentUser đang follow
  const myFollowings = await prisma.follow.findMany({
    where: { followerId: currentUserId },
    select: { followingId: true }
  });
  const myFollowingIds = myFollowings.map(f => f.followingId);

  if (myFollowingIds.length === 0) {
    return [];
  }

  // Lấy danh sách followers của target user mà cũng được follow bởi currentUser
  const targetFollowers = await prisma.follow.findMany({
    where: {
      followingId: targetUserId,
      followerId: { in: myFollowingIds }
    },
    select: {
      follower: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      }
    }
  });

  return targetFollowers.map(f => f.follower);
};

/**
 * Lấy gợi ý follow (2nd degree connections)
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} limit - Số lượng gợi ý (mặc định: 10)
 * @returns {Promise<Array>} Danh sách gợi ý users
 */
export const getFollowSuggestionsService = async (currentUserId, limit = 10) => {
  // Lấy danh sách những người mà currentUser đang follow
  const currentUserFollowings = await prisma.follow.findMany({
    where: { followerId: currentUserId },
    select: { followingId: true }
  });
  const followingIds = currentUserFollowings.map(f => f.followingId);

  if (followingIds.length === 0) {
    return [];
  }

  // Tìm những người được follow bởi những người mà currentUser đang follow
  const suggestions = await prisma.follow.findMany({
    where: {
      followerId: { in: followingIds },
      followingId: { notIn: [...followingIds, currentUserId] }
    },
    select: {
      following: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      }
    },
    distinct: ['followingId'],
    take: limit
  });

  return suggestions.map(s => s.following);
};

/**
 * Hủy follow request
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Result object
 */
export const cancelFollowRequestService = async (currentUserId, targetUserId) => {
  const existingRequest = await findFollowRequest(currentUserId, targetUserId);

  if (!existingRequest) {
    return {
      success: false,
      message: "Không có yêu cầu theo dõi nào để hủy."
    };
  }

  await prisma.followRequest.delete({
    where: { id: existingRequest.id }
  });

  return {
    success: true,
    message: "Đã hủy yêu cầu theo dõi."
  };
};
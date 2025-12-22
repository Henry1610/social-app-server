import { 
  updateFollowCacheAtomic,
  getFollowersList,
  getFollowingList,
  getFollowStatsService as getFollowStatsFromRedis
} from "./redis/followService.js";
import { getUserById } from "./userService.js";
import { createNotification } from "./notificationService.js";
import * as followRepository from "../repositories/followRepository.js";

// Re-export repository functions để maintain backward compatibility
export const getFollowersByUserId = followRepository.getFollowersByUserId;
export const getFollowingByUserId = followRepository.getFollowingByUserId;
export const isFollowing = followRepository.isFollowing;

//-----------------------------------------------------Main service-----------------------------------------------------

// Chấp nhận follow request
export const acceptFollowRequestService = async (currentUserId, targetUserId) => {
  // Kiểm tra follow request tồn tại
  const existingRequest = await followRepository.findFollowRequest(targetUserId, currentUserId);
  if (!existingRequest) {
    return {
      success: false,
      message: "Yêu cầu theo dõi không tồn tại!"
    };
  }
  
  // Tạo follow
  await followRepository.createFollow(targetUserId, currentUserId);
  // Sử dụng atomic operation để cập nhật cache và count cùng lúc
  await updateFollowCacheAtomic(targetUserId, currentUserId, 'follow');
  // Xóa follow request
  await followRepository.deleteFollowRequest(targetUserId, currentUserId);
  
  // Tạo notification
  try {
    await createNotification({
      userId: targetUserId,
      actorId: currentUserId,
      type: "FOLLOW_ACCEPTED",
      targetType: "USER",
      targetId: targetUserId
    });
  } catch (error) {
    console.error("Error creating notification in acceptFollowRequestService:", error);
  }
  
  return {
    success: true,
    message: "Đã chấp nhận yêu cầu theo dõi.",
  };
};

// Từ chối follow request
export const rejectFollowRequestService = async (targetUserId, currentUserId) => {
  // Kiểm tra follow request tồn tại
  const existingRequest = await followRepository.findFollowRequest(targetUserId, currentUserId);
  if (!existingRequest) {
    return {
      success: false,
      message: "Yêu cầu theo dõi không tồn tại!"
    };
  }
  
  // Xóa follow request
  await followRepository.deleteFollowRequest(targetUserId, currentUserId);
  
  // Tạo notification
  try {
    await createNotification({
      userId: targetUserId,
      actorId: currentUserId,
      type: "FOLLOW_REJECTED",
      targetType: "USER",
      targetId: targetUserId
    });
  } catch (error) {
    console.error("Error creating notification in rejectFollowRequestService:", error);
  }
  
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

    if (await followRepository.isFollowing(userId, followingId)) return { success: false, message: "Bạn đã theo dõi người dùng này!" };

    const isPrivate = !!targetUser?.privacySettings?.isPrivate;

    if (isPrivate) {
      if (await followRepository.hasFollowRequest(userId, followingId)) {
        return { success: false, message: "Bạn đã gửi yêu cầu theo dõi rồi!" };
      }

      await followRepository.createFollowRequest(userId, followingId);

      // Tạo notification cho follow request
      try {
        await createNotification({
          userId: followingId,
          actorId: userId,
          type: "FOLLOW_REQUEST",
          targetType: "USER",
          targetId: followingId
        });
      } catch (error) {
        console.error("Error creating notification in followUserService (follow_request):", error);
      }

      return { success: true, message: "Yêu cầu theo dõi đã gửi!", type: "follow_request", targetUser };
    } else {
      await followRepository.createFollow(userId, followingId);
      // Sử dụng atomic operation để cập nhật cache và count cùng lúc
      await updateFollowCacheAtomic(userId, followingId, 'follow');

      // Tạo notification cho follow
      try {
        await createNotification({
          userId: followingId,
          actorId: userId,
          type: "FOLLOW",
          targetType: "USER",
          targetId: followingId
        });
      } catch (error) {
        console.error("Error creating notification in followUserService (follow):", error);
      }

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
    const alreadyFollowing = await followRepository.isFollowing(userId, Number(followingId));
    if (!alreadyFollowing) {
      return { success: false, message: "Bạn chưa theo dõi người dùng này!" };
    }

    // Business logic
    await followRepository.deleteFollow(userId, Number(followingId));
    // Sử dụng atomic operation để cập nhật cache và count cùng lúc
    await updateFollowCacheAtomic(userId, Number(followingId), 'unfollow');

    // Xóa follow request nếu có
    await followRepository.deleteFollowRequestsByUserIds(userId, followingId);

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
    await getUserById(followingId, "Người dùng không tồn tại!");
    
    // Kiểm tra đã follow chưa
    const alreadyFollowing = await followRepository.isFollowing(followerId, Number(followingId));
    if (!alreadyFollowing) {
      return { success: false, message: "Người dùng này chưa theo dõi bạn!" };
    }

    await followRepository.deleteFollow(followerId, Number(followingId));
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
  return await followRepository.getFollowRequestsByUserId(userId);
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
  return await followRepository.isFollowing(currentUserId, targetUserId);
};

/**
 * Lấy danh sách followings với validation (có validation user và permission)
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Result object với success flag
 */
export const getFollowingsWithValidation = async (currentUserId, targetUserId) => {
  try {
    const user = await getUserById(targetUserId, 'User không tồn tại!');
    
    const hasPermission = await canViewFollowList(currentUserId, targetUserId, user);
    if (!hasPermission) {
      return {
        success: false,
        message: 'Tài khoản này là private. Bạn cần theo dõi để xem danh sách following!'
      };
    }

    const followings = await getFollowingList(targetUserId);

    return {
      success: true,
      followings
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        message: error.message || 'User không tồn tại!'
      };
    }
    console.error('Error in getFollowingsWithValidation:', error);
    return {
      success: false,
      message: 'Lỗi server khi lấy danh sách following!'
    };
  }
};

/**
 * Lấy danh sách followers với validation (có validation user và permission)
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Result object với success flag
 */
export const getFollowersWithValidation = async (currentUserId, targetUserId) => {
  try {
    const user = await getUserById(targetUserId, 'User không tồn tại!');
    
    const hasPermission = await canViewFollowList(currentUserId, targetUserId, user);
    if (!hasPermission) {
      return {
        success: false,
        message: 'Tài khoản này là private. Bạn cần theo dõi để xem danh sách followers!'
      };
    }

    const followers = await getFollowersList(targetUserId);

    return {
      success: true,
      followers
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return {
        success: false,
        message: error.message || 'User không tồn tại!'
      };
    }
    console.error('Error in getFollowersWithValidation:', error);
    return {
      success: false,
      message: 'Lỗi server khi lấy danh sách followers!'
    };
  }
};

/**
 * Lấy follow stats với validation (có validation user tồn tại)
 * @param {number} userId - ID của user
 * @returns {Promise<Object>} Result object với success flag
 */
export const getFollowStatsWithValidation = async (userId) => {
  try {
    const user = await followRepository.findUserById(userId);

    if (!user) {
      return {
        success: false,
        message: 'User không tồn tại!'
      };
    }

    const stats = await getFollowStatsFromRedis(userId);

    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error('Error in getFollowStatsWithValidation:', error);
    return {
      success: false,
      message: 'Lỗi server khi lấy thống kê follow!'
    };
  }
};

/**
 * Lấy follow status của user (internal, không check user tồn tại)
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Follow status object
 */
const getFollowStatusInternal = async (currentUserId, targetUserId) => {
  const user = await followRepository.getUserWithPrivacy(targetUserId);

  if (!user) {
    return null;
  }

  if (user.id === currentUserId) {
    // Nếu đang xem profile của chính mình
    const incomingFollowRequests = await followRepository.getFollowRequestsWithUserInfo(currentUserId);

    return {
      isSelf: true,
      isFollowing: false,
      incomingRequests: incomingFollowRequests
    };
  }

  // Kiểm tra các trạng thái follow
  const [isFollowingUser, isFollower, followRequest, incomingFollowRequest] = await Promise.all([
    followRepository.isFollowing(currentUserId, user.id),
    followRepository.isFollowing(user.id, currentUserId),
    followRepository.findFollowRequest(currentUserId, user.id),
    followRepository.findFollowRequest(user.id, currentUserId)
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
 * Lấy follow status của user (có validation)
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Result object với success flag
 */
export const getFollowStatusService = async (currentUserId, targetUserId) => {
  try {
    const user = await followRepository.findUserById(targetUserId);

    if (!user) {
      return {
        success: false,
        message: 'User không tồn tại!'
      };
    }

    const status = await getFollowStatusInternal(currentUserId, targetUserId);
    
    return {
      success: true,
      ...status
    };
  } catch (error) {
    console.error('Error in getFollowStatusService:', error);
    return {
      success: false,
      message: 'Lỗi server khi kiểm tra trạng thái follow!'
    };
  }
};

/**
 * Lấy danh sách người bạn follow cũng đang follow target user (có validation)
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Result object với success flag
 */
export const getAlsoFollowingService = async (currentUserId, targetUserId) => {
  try {
    const user = await followRepository.findUserById(targetUserId);

    if (!user) {
      return {
        success: false,
        message: 'User không tồn tại!'
      };
    }

    if (user.id === currentUserId) {
      return {
        success: false,
        message: 'Không thể kiểm tra với chính mình!'
      };
    }

    // Lấy danh sách người currentUser đang follow
    const myFollowingIds = await followRepository.getFollowingIdsByUserId(currentUserId);

    if (myFollowingIds.length === 0) {
      return {
        success: true,
        alsoFollowing: []
      };
    }

    // Lấy danh sách followers của target user mà cũng được follow bởi currentUser
    const targetFollowers = await followRepository.getFollowersByUserIds(targetUserId, myFollowingIds);

    return {
      success: true,
      alsoFollowing: targetFollowers.map(f => f.follower)
    };
  } catch (error) {
    console.error('Error in getAlsoFollowingService:', error);
    return {
      success: false,
      message: 'Lỗi server khi lấy danh sách also following!'
    };
  }
};

/**
 * Lấy gợi ý follow (2nd degree connections)
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} limit - Số lượng gợi ý (mặc định: 10)
 * @returns {Promise<Array>} Danh sách gợi ý users
 */
export const getFollowSuggestionsService = async (currentUserId, limit = 10) => {
  // Lấy danh sách những người mà currentUser đang follow
  const followingIds = await followRepository.getFollowingIdsByUserId(currentUserId);

  if (followingIds.length === 0) {
    return [];
  }

  // Tìm những người được follow bởi những người mà currentUser đang follow
  const suggestions = await followRepository.getFollowingsByFollowerIds(
    followingIds,
    [...followingIds, currentUserId],
    limit
  );

  return suggestions.map(s => s.following);
};

/**
 * Hủy follow request
 * @param {number} currentUserId - ID của user hiện tại
 * @param {number} targetUserId - ID của target user
 * @returns {Promise<Object>} Result object
 */
export const cancelFollowRequestService = async (currentUserId, targetUserId) => {
  const existingRequest = await followRepository.findFollowRequest(currentUserId, targetUserId);

  if (!existingRequest) {
    return {
      success: false,
      message: "Không có yêu cầu theo dõi nào để hủy."
    };
  }

  await followRepository.deleteFollowRequestById(existingRequest.id);

  return {
    success: true,
    message: "Đã hủy yêu cầu theo dõi."
  };
};
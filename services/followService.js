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
    const targetUser = await getUserById(followingId);
    if (!targetUser) return { success: false, message: "Người dùng không tồn tại!" };

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
    const targetUser = await getUserById(followingId);
    if (!targetUser) return { success: false, message: "Người dùng không tồn tại!" };
    
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

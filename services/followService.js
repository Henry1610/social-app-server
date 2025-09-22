import prisma from "../utils/prisma.js";
import { incrementFollowerCount, decrementFollowerCount } from "./redis/followService.js";
import { createNotification } from "./notificationService.js";
import { emitFollow, emitUnfollow, emitFollowRequest, emitFollowAccepted, emitFollowRejected } from "../socket/events/followEvents.js";
import { getUserById } from "./userService.js";

// Tạo follow
export const createFollow = async (followerId, followingId) => {
  return await prisma.follow.create({
    data: { followerId, followingId }
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
export const createFollowRequest = async (followerId, followingId) => {
  return await prisma.followRequest.create({
    data: { followerId, followingId }
  });
};

// Xóa follow request
export const deleteFollowRequest = async (followerId, followingId) => {
  return await prisma.followRequest.delete({
    where: { followerId_followingId: { followerId, followingId } }
  });
};

// Kiểm tra đã gửi follow request chưa
export const hasFollowRequest = async (followerId, followingId) => {
  const record = await prisma.followRequest.findFirst({
    where: { followerId, followingId },
    select: { followerId: true, followingId: true }
  });
  return !!record;
};

// Chấp nhận follow request
export const acceptFollowRequest = async (followerId, followingId) => {
  // Tạo follow
  await createFollow(followerId, followingId);
  await incrementFollowerCount(followingId);
  
  // Xóa follow request
  await deleteFollowRequest(followerId, followingId);
  
  // Tạo notification
  await createNotification({
    userId: followerId,
    actorId: followingId,
    type: "FOLLOW_ACCEPTED",
    targetType: "USER",
    targetId: followerId
  });
  
  // Emit realtime event
  emitFollowAccepted({ id: followingId }, { id: followerId });
};

// Từ chối follow request
export const rejectFollowRequest = async (followerId, followingId) => {
  // Xóa follow request
  await deleteFollowRequest(followerId, followingId);
  
  // Emit realtime event
  emitFollowRejected({ id: followingId }, { id: followerId });
};

// Service function chung cho follow user
export const followUserService = async (userId, followingId) => {
  try {
    // Validation
    if (Number(followingId) === userId) {
      return { success: false, message: "Không thể follow chính mình!" };
    }

    // Kiểm tra user có tồn tại không
    const targetUser = await getUserById(Number(followingId));
    if (!targetUser) {
      return { success: false, message: "Người dùng không tồn tại!" };
    }
    // Kiểm tra đã follow chưa
    const alreadyFollowing = await isFollowing(userId, Number(followingId));
    if (alreadyFollowing) {
      return { success: false, message: "Bạn đã theo dõi người dùng này!" };
    }

    // Kiểm tra đã gửi follow request chưa (cho tài khoản private)
    if (targetUser.isPrivate) {
      const hasRequest = await hasFollowRequest(userId, Number(followingId));
      if (hasRequest) {
        return { success: false, message: "Bạn đã gửi yêu cầu theo dõi rồi!" };
      }
    }

    // Kiểm tra tài khoản private
    if (targetUser.isPrivate) {
      // Tài khoản private - tạo follow request thay vì follow trực tiếp
      await createFollowRequest(userId, Number(followingId));
      
      // Tạo notification cho follow request
      await createNotification({
        userId: Number(followingId),
        actorId: userId,
        type: "FOLLOW_REQUEST",
        targetType: "USER",
        targetId: Number(followingId)
      });
      
      // Emit realtime event
      emitFollowRequest({ id: userId }, { id: Number(followingId) });

      return { 
        success: true, 
        message: "Yêu cầu theo dõi đã được gửi! Chờ người dùng chấp nhận.",
        isPrivate: true
      };
    } else {
      // Tài khoản public - follow trực tiếp
      await createFollow(userId, Number(followingId));
      await incrementFollowerCount(Number(followingId));
      
      // Tạo notification
      await createNotification({
        userId: Number(followingId),
        actorId: userId,
        type: "FOLLOW",
        targetType: "USER",
        targetId: Number(followingId)
      });
      
      // Emit realtime event
      emitFollow({ id: userId }, { id: Number(followingId) });

      return { 
        success: true, 
        message: "Bạn đã theo dõi người dùng!",
        isPrivate: false
      };
    }
  } catch (error) {
    console.error('Error in followUserService:', error);
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
    await decrementFollowerCount(Number(followingId));
    
    // Emit realtime event
    emitUnfollow(userId, Number(followingId));

    return { success: true, message: "Bạn đã hủy theo dõi người dùng!" };
  } catch (error) {
    console.error('Error in unfollowUserService:', error);
    return { success: false, message: "Lỗi server khi unfollow user!" };
  }
};


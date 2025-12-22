import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Follow operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Follow Operations ============

/**
 * Tạo follow relationship
 * @param {number} followerId - ID của người follow
 * @param {number} followingId - ID của người được follow
 * @returns {Promise<Object>} Follow record
 */
export const createFollow = async (followerId, followingId) => {
  return await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId,
        followingId
      }
    },
    update: {}, // Nếu đã tồn tại thì không update gì cả
    create: {
      followerId,
      followingId
    }
  });
};

/**
 * Xóa follow relationship
 * @param {number} followerId - ID của người follow
 * @param {number} followingId - ID của người được follow
 * @returns {Promise<Object>} Deleted follow record
 */
export const deleteFollow = async (followerId, followingId) => {
  return await prisma.follow.delete({
    where: { followerId_followingId: { followerId, followingId } }
  });
};

/**
 * Kiểm tra đã follow chưa
 * @param {number} followerId - ID của người follow
 * @param {number} followingId - ID của người được follow
 * @returns {Promise<boolean>} true nếu đã follow
 */
export const isFollowing = async (followerId, followingId) => {
  const record = await prisma.follow.findFirst({
    where: { followerId, followingId },
    select: { followerId: true, followingId: true }
  });
  return !!record;
};

/**
 * Lấy danh sách followers của một user
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Danh sách followers với user info
 */
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

/**
 * Lấy danh sách followings của một user
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Danh sách followings với user info
 */
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

/**
 * Lấy danh sách followings của một user (chỉ IDs)
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Array of followingIds
 */
export const getFollowingIdsByUserId = async (userId) => {
  const followings = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  });
  return followings.map(f => f.followingId);
};

/**
 * Lấy danh sách followers của nhiều users (dùng cho alsoFollowing)
 * @param {number} targetUserId - ID của target user
 * @param {Array<number>} followerIds - Array các follower IDs cần check
 * @returns {Promise<Array>} Danh sách followers
 */
export const getFollowersByUserIds = async (targetUserId, followerIds) => {
  return prisma.follow.findMany({
    where: {
      followingId: targetUserId,
      followerId: { in: followerIds }
    },
    select: {
      follower: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      }
    }
  });
};

/**
 * Lấy danh sách followings của nhiều users (dùng cho suggestions)
 * @param {Array<number>} followerIds - Array các follower IDs
 * @param {Array<number>} excludeIds - Array các IDs cần exclude
 * @param {number} limit - Số lượng kết quả
 * @returns {Promise<Array>} Danh sách followings
 */
export const getFollowingsByFollowerIds = async (followerIds, excludeIds, limit = 10) => {
  return prisma.follow.findMany({
    where: {
      followerId: { in: followerIds },
      followingId: { notIn: excludeIds }
    },
    select: {
      following: {
        select: { id: true, username: true, fullName: true, avatarUrl: true }
      }
    },
    distinct: ['followingId'],
    take: limit
  });
};

/**
 * Xóa nhiều follow requests
 * @param {number} fromUserId - ID của người gửi
 * @param {number} toUserId - ID của người nhận
 * @returns {Promise<Object>} Delete result
 */
export const deleteFollowRequestsByUserIds = async (fromUserId, toUserId) => {
  return prisma.followRequest.deleteMany({
    where: {
      fromUserId,
      toUserId,
    },
  });
};

// ============ Follow Request Operations ============

/**
 * Tạo follow request (cho tài khoản private)
 * @param {number} fromUserId - ID của người gửi request
 * @param {number} toUserId - ID của người nhận request
 * @returns {Promise<Object>} Follow request record
 */
export const createFollowRequest = async (fromUserId, toUserId) => {
  return await prisma.followRequest.create({
    data: { fromUserId, toUserId }
  });
};

/**
 * Xóa follow request
 * @param {number} fromUserId - ID của người gửi request
 * @param {number} toUserId - ID của người nhận request
 * @returns {Promise<Object>} Deleted follow request record
 */
export const deleteFollowRequest = async (fromUserId, toUserId) => {
  return await prisma.followRequest.delete({
    where: {
      fromUserId_toUserId: {
        fromUserId,
        toUserId
      }
    }
  });
};

/**
 * Xóa follow request theo ID
 * @param {number} requestId - ID của follow request
 * @returns {Promise<Object>} Deleted follow request record
 */
export const deleteFollowRequestById = async (requestId) => {
  return await prisma.followRequest.delete({
    where: { id: requestId }
  });
};

/**
 * Kiểm tra đã gửi follow request chưa
 * @param {number} fromUserId - ID của người gửi request
 * @param {number} toUserId - ID của người nhận request
 * @returns {Promise<boolean>} true nếu đã gửi request
 */
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

/**
 * Tìm follow request
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
 * Lấy danh sách follow requests của user
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Danh sách follow requests
 */
export const getFollowRequestsByUserId = async (userId) => {
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
 * Lấy danh sách follow requests với full user info (dùng cho status)
 * @param {number} userId - ID của user
 * @returns {Promise<Array>} Danh sách follow requests với full user info
 */
export const getFollowRequestsWithUserInfo = async (userId) => {
  return await prisma.followRequest.findMany({
    where: { toUserId: userId },
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
};

// ============ User Operations (for follow status) ============

/**
 * Lấy user với privacy settings
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} User object với privacySettings hoặc null
 */
export const getUserWithPrivacy = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      privacySettings: {
        select: { isPrivate: true }
      }
    }
  });
};

/**
 * Kiểm tra user tồn tại
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId }
  });
};


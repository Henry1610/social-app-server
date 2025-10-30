import { redisClient } from "../../utils/cache.js";
import { getFollowersByUserId, getFollowingByUserId } from "../followService.js";
import prisma from "../../utils/prisma.js";

// ============ CACHE TTL CONFIG ============
const CACHE_TTL = {
  COUNT: 300,        // 5 phút cho count (ổn định hơn)
  LIST: 120,         // 2 phút cho list (hay thay đổi)
  STATUS: 60,        // 1 phút cho status (rất hay đổi)
  STATS: 180,        // 3 phút cho stats tổng hợp
};


// ============ LIST OPERATIONS ============
// Lấy followers list
export const getFollowersList = async (userId) => {
  const cacheKey = `user:${userId}:followers`;

  const cached = await redisClient.get(cacheKey);
  if (cached) {
    
    return JSON.parse(cached);
  }

  

  const followersData = await getFollowersByUserId(userId);
  const followers = followersData.map(f => f.follower);

  // TTL ngắn hơn cho list (2 phút)
  await redisClient.set(cacheKey, JSON.stringify(followers), 'EX', CACHE_TTL.LIST);

  return followers;
};

// Lấy following list
export const getFollowingList = async (userId) => {
  const cacheKey = `user:${userId}:following`;

  const cached = await redisClient.get(cacheKey);
  if (cached) {
    
    return JSON.parse(cached);
  }

  

  const followingData = await getFollowingByUserId(userId);
  const following = followingData.map(f => f.following);

  await redisClient.set(cacheKey, JSON.stringify(following), 'EX', CACHE_TTL.LIST);

  return following;
};

// ============ ATOMIC OPERATIONS ============
// Atomic update cho follow action
export const updateFollowCacheAtomic = async (followerId, followingId, action) => {
  const multi = redisClient.multi();
  
  if (action === 'follow') {
    // 1. Update counts (nếu tồn tại)
    const followerCountKey = `user:${followingId}:followersCount`;
    const followingCountKey = `user:${followerId}:followingCount`;
    
    const [followerCount, followingCount] = await Promise.all([
      redisClient.get(followerCountKey),
      redisClient.get(followingCountKey)
    ]);
    
    if (followerCount !== null) {
      multi.incr(followerCountKey);
      multi.expire(followerCountKey, CACHE_TTL.COUNT);
    }
    
    if (followingCount !== null) {
      multi.incr(followingCountKey);
      multi.expire(followingCountKey, CACHE_TTL.COUNT);
    }
    
    // 2. Xóa cache list để force refresh
    multi.del(`user:${followingId}:followers`);
    multi.del(`user:${followerId}:following`);
    
    // 3. Xóa status cache
    multi.del(`follow:status:${followerId}:${followingId}`);
    
  } else if (action === 'unfollow') {
    const followerCountKey = `user:${followingId}:followersCount`;
    const followingCountKey = `user:${followerId}:followingCount`;
    
    const [followerCount, followingCount] = await Promise.all([
      redisClient.get(followerCountKey),
      redisClient.get(followingCountKey)
    ]);
    
    if (followerCount !== null) {
      multi.decr(followerCountKey);
      multi.expire(followerCountKey, CACHE_TTL.COUNT);
    }
    
    if (followingCount !== null) {
      multi.decr(followingCountKey);
      multi.expire(followingCountKey, CACHE_TTL.COUNT);
    }
    
    multi.del(`user:${followingId}:followers`);
    multi.del(`user:${followerId}:following`);
    multi.del(`follow:status:${followerId}:${followingId}`);
  }
  
  const results = await multi.exec();
  
  if (results.some(result => result[0] !== null)) {
    console.error(' Redis transaction failed:', results);
    throw new Error('Redis transaction failed');
  }
  
  
    followerId,
    followingId
  });
  
  return results;
};

// Invalidate toàn bộ cache của user
export const invalidateUserCache = async (userId) => {
  const multi = redisClient.multi();
  
  multi.del(`user:${userId}:followers`);
  multi.del(`user:${userId}:following`);
  multi.del(`user:${userId}:followersCount`);
  multi.del(`user:${userId}:followingCount`);
  multi.del(`user:${userId}:postCount`);
  multi.del(`user:${userId}:stats`);
  
  await multi.exec();
  
  
};

// ============ STATS SERVICE ============
export const getFollowStatsService = async (userId) => {
  const followersCountKey = `user:${userId}:followersCount`;
  const followingCountKey = `user:${userId}:followingCount`;
  const postCountKey = `user:${userId}:postCount`;

  // Followers count
  let followerCount = await redisClient.get(followersCountKey);
  
  if (followerCount === null) {
    followerCount = await prisma.follow.count({ where: { followingId: userId } });
    await redisClient.set(followersCountKey, String(followerCount), 'EX', CACHE_TTL.COUNT);
  } else {
    followerCount = parseInt(followerCount, 10);
  }

  // Following count
  let followingCount = await redisClient.get(followingCountKey);
  if (followingCount === null) {
    followingCount = await prisma.follow.count({ where: { followerId: userId } });
    await redisClient.set(followingCountKey, String(followingCount), 'EX', CACHE_TTL.COUNT);
  } else {
    followingCount = parseInt(followingCount, 10);
  }

  // Posts count
  let postCount = await redisClient.get(postCountKey);
  if (postCount === null) {
    postCount = await prisma.post.count({ where: { userId } });
    await redisClient.set(postCountKey, String(postCount), 'EX', CACHE_TTL.COUNT);
  } else {
    postCount = parseInt(postCount, 10);
  }

  return { followerCount, followingCount, postCount };
};

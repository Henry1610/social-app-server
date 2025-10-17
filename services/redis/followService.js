import { redisClient } from "../../utils/cache.js";
import { getFollowersByUserId, getFollowingByUserId } from "../followService.js";
import prisma from "../../utils/prisma.js";
// tăng followers count
export const incrementFollowerCount = async (userId) => {
  await redisClient.incr(`user:${userId}:followersCount`);
};

// giảm followers count
export const decrementFollowerCount = async (userId) => {
  await redisClient.decr(`user:${userId}:followersCount`);
};

// lấy followers list
export const getFollowersList = async (userId) => {
  const cacheKey = `user:${userId}:followers`; //  định nghĩa cacheKey

  // Lấy cache từ Redis
  const cached = await redisClient.get(cacheKey); //  lấy giá trị thực từ Redis
  if (cached) {
    console.log('Cache hit');
    return JSON.parse(cached);
  }

  console.log('Cache miss');

  // Nếu không có cache, lấy từ DB
  const followersData = await getFollowersByUserId(userId);
  const followers = followersData.map(f => f.follower);

  // Lưu vào Redis với thời gian sống 1 giờ
  await redisClient.set(cacheKey, JSON.stringify(followers), 'EX', 3600);

  return followers;
};

// lấy following list
export const getFollowingList = async (userId) => {
  const cacheKey = `user:${userId}:following`; //  định nghĩa cacheKey

  // Lấy cache từ Redis
  const cached = await redisClient.get(cacheKey); //  lấy giá trị thực từ Redis
  if (cached) {
    return JSON.parse(cached);
  }

  // Nếu không có cache, lấy từ DB
  const followingData = await getFollowingByUserId(userId);
  const following = followingData.map(f => f.following);

  // Lưu vào Redis với thời gian sống 1 giờ
  await redisClient.set(cacheKey, JSON.stringify(following), 'EX', 3600);

  return following;
}

export const getFollowStatsService = async (userId) => {
  const followersCountKey = `user:${userId}:followersCount`;
  const followingCountKey = `user:${userId}:followingCount`;
  const postCountKey = `user:${userId}:postCount`;

  // Followers count
  let followerCount = await redisClient.get(followersCountKey);
  if (followerCount === null) {
    followerCount = await prisma.follow.count({ where: { followingId: userId } });
    await redisClient.set(followersCountKey, String(followerCount), 'EX', 120);
  } else {
    followerCount = parseInt(followerCount, 10);
  }

  // Following count
  let followingCount = await redisClient.get(followingCountKey);
  if (followingCount === null) {
    followingCount = await prisma.follow.count({ where: { followerId: userId } });
    await redisClient.set(followingCountKey, String(followingCount), 'EX', 120);
  } else {
    followingCount = parseInt(followingCount, 10);
  }

  // Posts count
  let postCount = await redisClient.get(postCountKey);
  if (postCount === null) {
    postCount = await prisma.post.count({ where: { userId } });
    await redisClient.set(postCountKey, String(postCount), 'EX', 120);
  } else {
    postCount = parseInt(postCount, 10);
  }

  return { followerCount, followingCount, postCount };
};

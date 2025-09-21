import { redisClient } from "../../utils/cache.js";
import { getFollowersByUserId,getFollowingByUserId } from "../followService.js";
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
    console.log('Cache hit');
    return JSON.parse(cached);
  }

  console.log('Cache miss');

  // Nếu không có cache, lấy từ DB
  const followingData = await getFollowingByUserId(userId);
  const following = followingData.map(f => f.following);

  // Lưu vào Redis với thời gian sống 1 giờ
  await redisClient.set(cacheKey, JSON.stringify(following), 'EX', 3600);

  return following;
}


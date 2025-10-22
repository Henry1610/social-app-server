import { redisClient } from "../../utils/cache.js";

// Key helpers
const HISTORY_KEY = (userId) => `search_history:${userId}`; // Redis LIST

export const addSearchSelection = async (userId, entity, options = {}) => {
  const {
    maxItems = 20,                     // Số lượng lịch sử tối đa
    ttlSeconds = 60 * 60 * 24 * 7,     // TTL = 7 ngày
  } = options;

  const key = HISTORY_KEY(userId);
  if (!entity || !entity.type) return;

  // Tạo item mới để lưu
  const item = {
    type: entity.type,
    user: entity.type === 'user' ? {
      id: entity.id,
      username: entity.username,
      fullName: entity.fullName,
      avatarUrl: entity.avatarUrl,
    } : undefined,
    t: Date.now(), // timestamp
  };

  //  Kiểm tra toàn bộ danh sách để xóa item trùng (nếu có)
  const items = await redisClient.lrange(key, 0, -1);
  for (const raw of items) {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed.type === item.type &&
        parsed?.user?.id &&
        item?.user?.id &&
        parsed.user.id === item.user.id
      ) {
        await redisClient.lrem(key, 1, raw); // Xóa bản cũ (chỉ 1 cái)
        break;
      }
    } catch {}
  }

  //  Thêm item mới lên đầu danh sách
  await redisClient.lpush(key, JSON.stringify(item));

  //  Giữ tối đa `maxItems` phần tử mới nhất
  await redisClient.ltrim(key, 0, maxItems - 1);

  //  Gia hạn TTL (thời gian tồn tại)
  await redisClient.expire(key, ttlSeconds);
};


export const getSearchHistory = async (userId, page = 1, limit = 10) => {
  const key = HISTORY_KEY(userId);
  const start = Math.max(0, (page - 1) * limit);
  const end = start + limit - 1;

  const [items, total] = await Promise.all([
    redisClient.lrange(key, start, end),
    redisClient.llen(key),
  ]);

  const history = items.map((s) => {
    try { return JSON.parse(s); } catch { return null; }
  }).filter(Boolean);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 0,
    },
  };
};

export const clearSearchHistory = async (userId) => {
  const key = HISTORY_KEY(userId);
  await redisClient.del(key);
  return true;
};

// Remove a specific item from history (by type and id)
export const removeSearchItem = async (userId, { type, userId: targetUserId }) => {
  const key = HISTORY_KEY(userId);
  const items = await redisClient.lrange(key, 0, -1);
  for (const raw of items) {
    try {
      const parsed = JSON.parse(raw);
      if (type === 'user' && parsed?.user?.id == targetUserId) {
        await redisClient.lrem(key, 1, raw);
        break;
      }
    } catch {}
  }
  return true;
};



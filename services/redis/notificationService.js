import { redisClient } from "../../utils/cache.js";

// Redis key patterns
const NOTIFICATION_KEY = (userId) => `notifications:${userId}`;

// Lưu thông báo vào Redis cache
export const cacheNotification = async (userId, notification) => {
  try {
    const key = NOTIFICATION_KEY(userId);
    const notificationData = {
      id: notification.id,
      type: notification.type,
      targetType: notification.targetType,
      targetId: notification.targetId,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      readAt: notification.readAt
    };

    // Lưu thông báo mới nhất vào đầu list
    await redisClient.lpush(key, JSON.stringify(notificationData));

    // Giới hạn số lượng thông báo trong cache (100 thông báo gần nhất)
    await redisClient.ltrim(key, 0, 99);

    // Tăng số lượng thông báo chưa đọc
    // if (!notification.readAt) {
    //   await redisClient.incr(UNREAD_COUNT_KEY(userId));
    // }

    return true;
  } catch (error) {
    console.error('Error caching notification:', error);
    return false;
  }
};

// Lấy thông báo từ Redis cache
export const getCachedNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const key = NOTIFICATION_KEY(userId);
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    const notifications = await redisClient.lrange(key, start, end);
    const total = await redisClient.llen(key);

    return {
      notifications: notifications.map(notif => JSON.parse(notif)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting cached notifications:', error);
    return { notifications: [], pagination: { page, limit, total: 0, pages: 0 } };
  }
};



// Xóa cache thông báo của user
export const clearNotificationCache = async (userId) => {
  try {
    const key = NOTIFICATION_KEY(userId);
    const unreadKey = UNREAD_COUNT_KEY(userId);

    await redisClient.del(key);
    await redisClient.del(unreadKey);

    return true;
  } catch (error) {
    console.error('Error clearing notification cache:', error);
    return false;
  }
};

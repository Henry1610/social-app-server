import { redisClient } from "../../utils/cache.js";

// Redis key patterns
const NOTIFICATION_KEY = (userId) => `notifications:${userId}`;
const UNREAD_COUNT_KEY = (userId) => `unread_count:${userId}`;

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
    if (!notification.readAt) {
      await redisClient.incr(UNREAD_COUNT_KEY(userId));
    }

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

// Lấy số lượng thông báo chưa đọc
export const getUnreadCount = async (userId) => {
  try {
    const count = await redisClient.get(UNREAD_COUNT_KEY(userId));
    return parseInt(count) || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Đánh dấu thông báo đã đọc trong cache
export const markNotificationAsReadInCache = async (userId, notificationId) => {
  try {
    const key = NOTIFICATION_KEY(userId);
    const notifications = await redisClient.lrange(key, 0, -1);
    
    for (let i = 0; i < notifications.length; i++) {
      const notification = JSON.parse(notifications[i]);
      if (notification.id === notificationId && !notification.readAt) {
        notification.readAt = new Date().toISOString();
        await redisClient.lset(key, i, JSON.stringify(notification));
        
        // Giảm số lượng thông báo chưa đọc
        await redisClient.decr(UNREAD_COUNT_KEY(userId));
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error marking notification as read in cache:', error);
    return false;
  }
};

// Đánh dấu tất cả thông báo đã đọc trong cache
export const markAllNotificationsAsReadInCache = async (userId) => {
  try {
    const key = NOTIFICATION_KEY(userId);
    const notifications = await redisClient.lrange(key, 0, -1);
    
    const updatedNotifications = notifications.map(notif => {
      const notification = JSON.parse(notif);
      if (!notification.readAt) {
        notification.readAt = new Date().toISOString();
      }
      return JSON.stringify(notification);
    });

    if (updatedNotifications.length > 0) {
      await redisClient.del(key);
      await redisClient.lpush(key, ...updatedNotifications);
    }

    // Reset số lượng thông báo chưa đọc về 0
    await redisClient.set(UNREAD_COUNT_KEY(userId), 0);
    
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read in cache:', error);
    return false;
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
import prisma from "../utils/prisma.js";
import { getUserById } from "./userService.js";
import {
  cacheNotification,
  getCachedNotifications,
  getUnreadCount,
  markNotificationAsReadInCache,
  markAllNotificationsAsReadInCache
} from "./redis/notificationService.js";
const TIME_WINDOW = 5 * 60 * 1000;

export const createNotification = async ({
  userId,
  actorId,
  type,
  targetType,
  targetId,
}) => {
  const now = new Date();
  const NON_GROUP_TYPES = [
    "MESSAGE",
  ];

  if (NON_GROUP_TYPES.includes(type)) {
    // Không gom nhóm cho các loại này
    const key = {
      userId_type_targetType_targetId: {
        userId,
        type,
        targetType,
        targetId
      }
    };

    const notification = await prisma.notification.upsert({
      where: key,
      update: { updatedAt: now },
      create: {
        user: { connect: { id: userId } },
        actor: { connect: { id: actorId } },
        type,
        targetType,
        targetId,
      }
    });

    await cacheNotification(userId, notification);
    return notification;
  }

  // Gom nhóm cho các loại còn lại
  const key = {
    userId_type_targetType_targetId: {
      userId,
      type,
      targetType,
      targetId
    }
  };

  // Thử tìm notification hiện có
  let notification = await prisma.notification.findUnique({ where: key });

  if (
    notification &&
    now.getTime() - notification.updatedAt.getTime() < TIME_WINDOW
  ) {
    // Nếu trong TIME_WINDOW → gom vào notification cũ
    const metadata = notification.metadata || {};
    metadata.actorIds = metadata.actorIds || [];

    if (!metadata.actorIds.includes(actorId)) {
      metadata.actorIds.push(actorId);
    }

    metadata.count = metadata.actorIds.length;
    metadata.lastActorName = await getUserName(actorId);

    notification = await prisma.notification.upsert({
      where: key,
      update: { metadata, updatedAt: now },
      create: {
        user: { connect: { id: userId } },
        actor: { connect: { id: actorId } },
        type,
        targetType,
        targetId,
        metadata
      }
    });
  } else {
    // Quá hạn TIME_WINDOW hoặc chưa có notification → tạo mới
    const metadata = {
      actorIds: [actorId],
      count: 1,
      lastActorName: await getUserName(actorId)
    };

    notification = await prisma.notification.upsert({
      where: key,
      update: { metadata, updatedAt: now },
      create: {
        user: { connect: { id: userId } },
        actor: { connect: { id: actorId } },
        type,
        targetType,
        targetId,
        metadata
      }
    });
  }

  // Cập nhật cache 
  await cacheNotification(userId, notification);

  return notification;
};


// Hàm lấy tên user theo ID
const getUserName = async (userId) => {
  try {
    const user = await getUserById(userId);
    return user ? user.name || user.username : 'Unknown User';
  } catch (error) {
    console.error('Error getting user name:', error);
    return 'Unknown User';
  }
};


// Hàm lấy thông báo của user (ưu tiên cache Redis)
export const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    // Thử lấy từ cache trước
    const cachedResult = await getCachedNotifications(userId, page, limit);

    if (cachedResult.notifications.length > 0) {
      return cachedResult;
    }

    // Nếu cache không có, lấy từ database
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.notification.count({
      where: { userId }
    });

    const result = {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Cache kết quả để lần sau sử dụng
    if (notifications.length > 0) {
      notifications.forEach(notification => {
        cacheNotification(userId, notification);
      });
    }

    return result;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

// Hàm đánh dấu thông báo đã đọc
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId
      },
      data: {
        readAt: new Date()
      }
    });

    // Cập nhật cache
    if (notification.count > 0) {
      await markNotificationAsReadInCache(userId, notificationId);
    }

    return notification.count > 0;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Hàm đánh dấu tất cả thông báo đã đọc
export const markAllNotificationsAsRead = async (userId) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    // Cập nhật cache
    await markAllNotificationsAsReadInCache(userId);

    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

// Hàm lấy số lượng thông báo chưa đọc
export const getUnreadNotificationCount = async (userId) => {
  try {
    // Thử lấy từ cache trước
    const cachedCount = await getUnreadCount(userId);
    if (cachedCount > 0) {
      return cachedCount;
    }

    // Nếu cache không có, lấy từ database
    const count = await prisma.notification.count({
      where: {
        userId,
        readAt: null
      }
    });

    return count;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
};

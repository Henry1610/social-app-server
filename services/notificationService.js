import prisma from "../utils/prisma.js";
import { getUserById } from "./userService.js";
import {
  cacheNotification,
  getCachedNotifications,
  clearNotificationCache
} from "./redis/notificationService.js";
import { formatNotificationMessage } from "../utils/notificationText.js";
const TIME_WINDOW = 5 * 60 * 1000; // 5 phút

export const createNotification = async ({
  userId,
  actorId,
  type,
  targetType,
  targetId,
}) => {
  const now = new Date();

  // Các loại thông báo không gom nhóm
  const NON_GROUP_TYPES = ["MESSAGE"];

  // Các loại thông báo gom nhóm theo target (bài viết, user, etc.)
  const GROUP_BY_TARGET_TYPES = ["LIKE", "COMMENT", "REPOST"];

  // Các loại thông báo gom nhóm theo loại (không phân biệt target)
  const GROUP_BY_TYPE_TYPES = ["FOLLOW", "FOLLOW_REQUEST", "FOLLOW_ACCEPTED", "FOLLOW_REJECTED",];

  if (NON_GROUP_TYPES.includes(type)) {
    // Không gom nhóm - tạo thông báo riêng biệt
    return await createSingleNotification({
      userId,
      actorId,
      type,
      targetType,
      targetId,
      now
    });
  }

  if (GROUP_BY_TARGET_TYPES.includes(type)) {
    // Gom nhóm theo target (bài viết, comment, etc.)
    return await createGroupedNotification({
      userId,
      actorId,
      type,
      targetType,
      targetId,
      now
    });
  }

  if (GROUP_BY_TYPE_TYPES.includes(type)) {
    // Gom nhóm theo loại (follow, follow_request)
    return await createGroupedNotification({
      userId,
      actorId,
      type,
      targetType,
      now
    });
  }

  // Mặc định: tạo thông báo đơn lẻ
  return await createSingleNotification({
    userId,
    actorId,
    type,
    targetType,
    targetId,
    now
  });
};

// Tạo thông báo đơn lẻ
const createSingleNotification = async ({ userId, actorId, type, targetType, targetId, now }) => {
  const notification = await prisma.notification.create({
    data: {
      user: { connect: { id: userId } },
      actor: { connect: { id: actorId } },
      type,
      targetType,
      targetId,
    }
  });

  await cacheNotification(userId, notification);
  return notification;
};

const createGroupedNotification = async ({ userId, actorId, type, targetType, targetId, now }) => {
  const where = targetId != null
    ? { userId_type_targetType_targetId: { userId, type, targetType, targetId } }
    : { userId_type_targetType: { userId, type, targetType } };

  const existing = await prisma.notification.findUnique({ where });

  if (existing) {
    const isExpired = now - existing.updatedAt > TIME_WINDOW;
    const metadata = existing.metadata || {};
    metadata.actorIds = metadata.actorIds || [];

    if (!isExpired) {
      if (!metadata.actorIds.includes(actorId)) {
        metadata.actorIds.push(actorId);
        metadata.count = metadata.actorIds.length;
        metadata.lastActorName = await getUserById(actorId);

        const updated = await prisma.notification.update({
          where: { id: existing.id },
          data: { metadata, updatedAt: now }
        });

        await cacheNotification(userId, updated);
        return updated;
      }
      return existing;
    }

    if (metadata.actorIds.length > 1) {
      metadata.actorIds = metadata.actorIds.filter(id => id !== actorId);
      metadata.count = metadata.actorIds.length;

      const updated = await prisma.notification.update({
        where: { id: existing.id },
        data: { metadata }
      });
      await cacheNotification(userId, updated);
    } else {
      await prisma.notification.delete({ where: { id: existing.id } });
      await clearNotificationCache(userId);
    }
  }

  const metadata = {
    actorIds: [actorId],
    count: 1,
    lastActorName: await getUserById(actorId)
  };

  const notification = await prisma.notification.create({
    data: {
      user: { connect: { id: userId } },
      actor: { connect: { id: actorId } },
      type,
      targetType,
      targetId: targetId ?? null,
      metadata,
      updatedAt: now
    }
  });

  await cacheNotification(userId, notification);
  return notification;
};

// Hàm lấy thông báo của user (ưu tiên cache Redis)
export const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    // Thử lấy từ cache trước
    const cachedResult = await getCachedNotifications(userId, page, limit);

    if (cachedResult.notifications.length > 0) {
      // Format luôn cache
      const formattedCached = cachedResult.notifications.map(n => ({
        ...n,
        message: formatNotificationMessage({
          ...n,
          actor: n.actor || n.metadata?.lastActorName,
        }),
      }));

      return {
        ...cachedResult,
        notifications: formattedCached,
      };
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
    const formatted = notifications.map(n => ({

      message: formatNotificationMessage(n),
    }));
    const result = {
      notifications: formatted,
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


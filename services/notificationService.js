import prisma from "../utils/prisma.js";
import { getUserById } from "./userService.js";
import { formatNotificationMessage } from "../utils/notificationText.js";
import { getIO } from "../config/socket.js";

const TIME_WINDOW = 5 * 60 * 1000;

const ACTOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true
};

const generateGroupKey = (type, targetType, targetId, now) => {
  const windowIndex = Math.floor(now.getTime() / TIME_WINDOW);
  if (targetId != null) {
    return `${type}_${targetType}_${targetId}_${windowIndex}`;
  }
  return `${type}_${targetType}_${windowIndex}`;
};

export const createNotification = async ({
  userId,
  actorId,
  type,
  targetType,
  targetId,
}) => {
  const now = new Date();

  const EMIT_ONLY_TYPES = ["MESSAGE"];
  const INDIVIDUAL_TYPES = ["FOLLOW", "FOLLOW_REQUEST", "FOLLOW_ACCEPTED", "FOLLOW_REJECTED"];

  if (EMIT_ONLY_TYPES.includes(type)) {
    return await createSingleNotification({
      userId,
      actorId,
      type,
      targetType,
      targetId,
      now
    });
  }

  if (INDIVIDUAL_TYPES.includes(type)) {
    return await createIndividualNotification({
      userId,
      actorId,
      type,
      targetType,
      targetId,
      now
    });
  }

    return await createGroupedNotification({
    userId,
    actorId,
    type,
    targetType,
    targetId,
    now
  });
};

const emitNotification = (userId, notification) => {
  try {
    const io = getIO();
    const formattedNotification = {
      ...notification,
      message: formatNotificationMessage(notification)
    };
    io.to(`user_${userId}`).emit('notification', formattedNotification);
  } catch (error) {
    console.error('Error emitting notification via socket:', error);
  }
};

const createSingleNotification = async ({
  userId,
  actorId,
  type,
  targetType,
  targetId,
  now
}) => {
  try {
    const actorFull = await getUserById(actorId);
    // Chỉ lấy các field cần thiết cho actor (loại bỏ privacySettings và createdAt)
    const { privacySettings, createdAt, ...actor } = actorFull;

    const notification = {
      userId,
      actorId,
      type,
      targetType,
      targetId,
      actor,
      createdAt: now,
      updatedAt: now
    };

    emitNotification(userId, notification);
    return notification;
  } catch (error) {
    console.error('Error emitting notification via socket:', error);
    return null;
  }
};

const createIndividualNotification = async ({
  userId,
  actorId,
  type,
  targetType,
  targetId,
  now
}) => {
  try {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type,
        targetType,
        targetId: targetId ?? null,
        groupKey: null
      }
    });

    let notification;

    if (existing) {
      notification = await prisma.notification.update({
        where: { id: existing.id },
        data: { actorId, updatedAt: now },
        include: { actor: { select: ACTOR_SELECT } }
      });
    } else {
      try {
        notification = await prisma.notification.create({
    data: {
      user: { connect: { id: userId } },
      actor: { connect: { id: actorId } },
      type,
      targetType,
      targetId,
            groupKey: null
          },
          include: { actor: { select: ACTOR_SELECT } }
        });
      } catch (createError) {
        if (createError.code === 'P2002') {
          const existingAfterRetry = await prisma.notification.findFirst({
            where: {
              userId,
              type,
              targetType,
              targetId: targetId ?? null,
              groupKey: null
            },
            include: { actor: { select: ACTOR_SELECT } }
          });

          if (existingAfterRetry) {
            notification = existingAfterRetry;
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    emitNotification(userId, notification);

  return notification;
  } catch (error) {
    console.error('Error creating individual notification:', error);
    throw error;
  }
};

const createGroupedNotification = async ({
  userId,
  actorId,
  type,
  targetType,
  targetId,
  now
}) => {
  try {
    const groupKey = generateGroupKey(type, targetType, targetId, now);

    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type,
        targetType,
        targetId: targetId ?? null,
        groupKey
      },
      include: { actor: { select: ACTOR_SELECT } }
    });

  if (existing) {
      const timeSinceUpdate = now.getTime() - existing.updatedAt.getTime();
      const isExpired = timeSinceUpdate > TIME_WINDOW;

      if (isExpired) {
        return await createNewGroupedNotification({
          userId,
          actorId,
          type,
          targetType,
          targetId,
          now
        });
      }

      const metadata = existing.metadata || {};
      metadata.actorIds = metadata.actorIds || [];

      if (metadata.actorIds.includes(actorId)) {
      return existing;
    }

      metadata.actorIds.push(actorId);
      metadata.count = metadata.actorIds.length;
      metadata.lastActorName = await getUserById(actorId);

      const updated = await prisma.notification.update({
        where: { id: existing.id },
        data: { metadata, updatedAt: now },
        include: { actor: { select: ACTOR_SELECT } }
      });

      emitNotification(userId, updated);

      return updated;
    }

    return await createNewGroupedNotification({
      userId,
      actorId,
      type,
      targetType,
      targetId,
      now
    });
  } catch (error) {
    console.error('Error creating grouped notification:', error);
    throw error;
  }
};

const createNewGroupedNotification = async ({
  userId,
  actorId,
  type,
  targetType,
  targetId,
  now
}) => {
  const groupKey = generateGroupKey(type, targetType, targetId, now);
  const lastActorName = await getUserById(actorId);

  const notification = await prisma.notification.create({
    data: {
      user: { connect: { id: userId } },
      actor: { connect: { id: actorId } },
      type,
      targetType,
      targetId: targetId ?? null,
      groupKey,
      metadata: {
        actorIds: [actorId],
        count: 1,
        lastActorName: lastActorName
      },
      updatedAt: now
    },
    include: { actor: { select: ACTOR_SELECT } }
  });

  emitNotification(userId, notification);

  return notification;
};
export const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: { actor: { select: ACTOR_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const total = await prisma.notification.count({
      where: { userId }
    });

    const formatted = notifications.map(n => ({
      ...n,
      message: formatNotificationMessage(n),
    }));

    return {
      notifications: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};


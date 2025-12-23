import { getUserById } from "./userService.js";
import { formatNotificationMessage } from "../utils/notificationText.js";
import { getIO } from "../config/socket.js";
import * as notificationRepository from "../repositories/notificationRepository.js";

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
  metadata,
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
    now,
    metadata
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
    const existing = await notificationRepository.findNotificationByGroupKey(
      userId,
      type,
      targetType,
      targetId,
      null,
      { actor: { select: ACTOR_SELECT } }
    );

    let notification;

    if (existing) {
      notification = await notificationRepository.updateNotification(
        existing.id,
        { actorId, updatedAt: now },
        { actor: { select: ACTOR_SELECT } }
      );
    } else {
      try {
        notification = await notificationRepository.createNotification(
          {
            userId,
            actorId,
            type,
            targetType,
            targetId,
            groupKey: null
          },
          { actor: { select: ACTOR_SELECT } }
        );
      } catch (createError) {
        if (createError.code === 'P2002') {
          const existingAfterRetry = await notificationRepository.findNotificationByGroupKey(
            userId,
            type,
            targetType,
            targetId,
            null,
            { actor: { select: ACTOR_SELECT } }
          );

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
  now,
  metadata: additionalMetadata
}) => {
  try {
    const groupKey = generateGroupKey(type, targetType, targetId, now);

    const existing = await notificationRepository.findNotificationByGroupKey(
      userId,
      type,
      targetType,
      targetId,
      groupKey,
      { actor: { select: ACTOR_SELECT } }
    );

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
          now,
          additionalMetadata
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
      
      // Merge additional metadata (như postId, repostId) vào metadata hiện có
      if (additionalMetadata) {
        Object.assign(metadata, additionalMetadata);
      }

      const updated = await notificationRepository.updateNotification(
        existing.id,
        { metadata, updatedAt: now },
        { actor: { select: ACTOR_SELECT } }
      );

      emitNotification(userId, updated);

      return updated;
    }

    return await createNewGroupedNotification({
      userId,
      actorId,
      type,
      targetType,
      targetId,
      now,
      additionalMetadata
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
  now,
  additionalMetadata
}) => {
  const groupKey = generateGroupKey(type, targetType, targetId, now);
  const lastActorName = await getUserById(actorId);

  const baseMetadata = {
    actorIds: [actorId],
    count: 1,
    lastActorName: lastActorName
  };

  // Merge additional metadata (như postId, repostId) vào metadata
  const metadata = additionalMetadata 
    ? { ...baseMetadata, ...additionalMetadata }
    : baseMetadata;

  const notification = await notificationRepository.createNotification(
    {
      userId,
      actorId,
      type,
      targetType,
      targetId,
      groupKey,
      metadata,
      updatedAt: now
    },
    { actor: { select: ACTOR_SELECT } }
  );

  emitNotification(userId, notification);

  return notification;
};
export const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const [notifications, total] = await Promise.all([
      notificationRepository.findNotificationsByUserId(userId, {
        page,
        limit,
        include: { actor: { select: ACTOR_SELECT } }
      }),
      notificationRepository.countNotificationsByUserId(userId)
    ]);

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


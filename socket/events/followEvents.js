import EventEmitter from "events";
import { getIO } from "../../config/socket.js";
import { createNotification } from "../../services/notificationService.js";
import { formatNotificationMessage } from "../../utils/notificationText.js";
import prisma from "../../utils/prisma.js";

export const followEvents = new EventEmitter();

followEvents.on("follow_completed", async ({ actor, targetUserId }) => {
  try {
    const notification = await createNotification({
      userId: targetUserId,
      actorId: actor.id,
      type: "FOLLOW",
      targetType: "USER",
      targetId: targetUserId
    });

    const fullNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
      include: { actor: true }
    });
    const message = formatNotificationMessage(fullNotification);

    const io = getIO();
    io.to(`user_${targetUserId}`).emit("notification", {
      id: notification.id,
      type: "FOLLOW",
      from: actor,
      message: message,
      metadata: notification.metadata,  
    });
  } catch (error) {
    console.error("Error in follow_completed event:", error);
  }
});

followEvents.on("follow_request_sent", async ({ actor, targetUserId }) => {
  try {
    const notification = await createNotification({
      userId: targetUserId,
      actorId: actor.id,
      type: "FOLLOW_REQUEST",
      targetType: "USER",
      targetId: targetUserId
    });

    // Lấy thông tin đầy đủ của notification để format message
    const fullNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
      include: { actor: true }
    });

    const message = formatNotificationMessage(fullNotification);
    
    const io = getIO();
    io.to(`user_${targetUserId}`).emit("notification", {
      id: notification.id,
      type: "FOLLOW_REQUEST",
      from: actor,
      message: message,
      metadata: notification.metadata,
      timestamp: notification.updatedAt || notification.createdAt
    });
  } catch (error) {
    console.error("Error in follow_request_sent event:", error);
  }
});

followEvents.on("follow_request_accepted", async ({ actor, targetUserId }) => {
  try {
    // 1 Tạo thông báo trong DB
    const notification = await createNotification({
      userId: targetUserId,          // Người nhận thông báo là người đã gửi request
      actorId: actor.id,           // Người vừa chấp nhận là actor
      type: "FOLLOW_ACCEPTED",
      targetType: "USER",
      targetId: targetUserId
    });

    // 2️ Lấy lại thông tin đầy đủ để render message
    const fullNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
      include: { actor: true }
    });

    const message = formatNotificationMessage(fullNotification);

    // Gửi real-time qua socket
    const io = getIO();
    io.to(`user_${targetUserId}`).emit("notification", {
      id: notification.id,
      type: "FOLLOW_ACCEPTED",
      from: actor,
      message,
      metadata: notification.metadata,
      timestamp: notification.updatedAt || notification.createdAt
    });

    
  } catch (error) {
    console.error(" Error in follow_request_accepted event:", error);
  }
});

followEvents.on("follow_request_rejected", async ({ actor, targetUserId }) => {
  try {
    // 1. Tạo thông báo trong DB
    const notification = await createNotification({
      userId: targetUserId,          // Người nhận thông báo là người đã gửi request
      actorId: actor.id,           // Người vừa từ chối là actor
      type: "FOLLOW_REJECTED",
      targetType: "USER",
      targetId: targetUserId
    });

    // 2. Lấy lại thông tin đầy đủ để render message
    const fullNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
      include: { actor: true }
    });

    const message = formatNotificationMessage(fullNotification);

    // Gửi real-time qua socket
    const io = getIO();
    io.to(`user_${targetUserId}`).emit("notification", {
      id: notification.id,
      type: "FOLLOW_REJECTED",
      from: actor,
      message,
      metadata: notification.metadata,
      timestamp: notification.updatedAt || notification.createdAt
    });

    
  } catch (error) {
    console.error("Error in follow_request_rejected event:", error);
  }
});
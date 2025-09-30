import EventEmitter from "events";
import { getIO } from "../../config/socket.js";

export const followEvents = new EventEmitter();
import { createNotification } from "../../services/notificationService.js";

followEvents.on("follow_completed", async ({ actor, targetUserId }) => {

  const notification = await createNotification({
    userId: targetUserId,
    actorId: actor.id,
    type: "FOLLOW",
    targetType: "USER",
    targetId: targetUserId
  });

  console.log("✅ Notification created:", notification);

  const io = getIO();
  io.to(`user_${targetUserId}`).emit("notification", {
    type: "FOLLOW",
    from: actor,
    message: `${actor.username} đã theo dõi bạn.`,
  });
});

followEvents.on("follow_request_sent", async ({ actor, targetUserId }) => {

  await createNotification({
    userId: targetUserId,
    actorId: actor.id,
    type: "FOLLOW_REQUEST",
    targetType: "USER",
    targetId: targetUserId
  });

  const io = getIO();
  io.to(`user_${targetUserId}`).emit("notification", {
    type: "FOLLOW_REQUEST",
    from: actor,
    message: `${actor.username} đã gửi yêu cầu theo dõi bạn.`,
  });
});

export const emitFollow = (follower, following) => {
  const io = getIO()
  io.to(`user_${following.id}`).emit("follow:new", { follower })
}

export const emitUnfollow = (followerId, followingId) => {
  const io = getIO()
  io.to(`user_${followingId}`).emit("follow:removed", { followerId })
}

export const emitFollowRequest = (follower, following) => {
  const io = getIO()
  io.to(`user_${following.id}`).emit("follow:request", { follower })
}

export const emitFollowAccepted = (following, follower) => {
  const io = getIO()
  io.to(`user_${follower.id}`).emit("follow:accepted", { following })
}

export const emitFollowRejected = (following, follower) => {
  const io = getIO()
  io.to(`user_${follower.id}`).emit("follow:rejected", { following })
}
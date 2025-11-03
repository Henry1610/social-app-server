import EventEmitter from "events";
import { createNotification } from "../../services/notificationService.js";

export const followEvents = new EventEmitter();

followEvents.on("follow_completed", async ({ actor, targetUserId }) => {
  try {
    await createNotification({
      userId: targetUserId,
      actorId: actor.id,
      type: "FOLLOW",
      targetType: "USER",
      targetId: targetUserId
    });
  } catch (error) {
    console.error("Error in follow_completed event:", error);
  }
});

followEvents.on("follow_request_sent", async ({ actor, targetUserId }) => {
  try {
    await createNotification({
      userId: targetUserId,
      actorId: actor.id,
      type: "FOLLOW_REQUEST",
      targetType: "USER",
      targetId: targetUserId
    });
  } catch (error) {
    console.error("Error in follow_request_sent event:", error);
  }
});

followEvents.on("follow_request_accepted", async ({ actor, targetUserId }) => {
  try {
    await createNotification({
      userId: targetUserId,
      actorId: actor.id,
      type: "FOLLOW_ACCEPTED",
      targetType: "USER",
      targetId: targetUserId
    });
  } catch (error) {
    console.error("Error in follow_request_accepted event:", error);
  }
});

followEvents.on("follow_request_rejected", async ({ actor, targetUserId }) => {
  try {
    await createNotification({
      userId: targetUserId,
      actorId: actor.id,
      type: "FOLLOW_REJECTED",
      targetType: "USER",
      targetId: targetUserId
    });
  } catch (error) {
    console.error("Error in follow_request_rejected event:", error);
  }
});
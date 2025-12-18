import { createNotification } from '../../../services/notificationService.js';

// Handler cho event follow_completed
export const handleFollowCompleted = async ({ actor, targetUserId }) => {
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
};

// Handler cho event follow_request_sent
export const handleFollowRequestSent = async ({ actor, targetUserId }) => {
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
};

// Handler cho event follow_request_accepted
export const handleFollowRequestAccepted = async ({ actor, targetUserId }) => {
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
};

// Handler cho event follow_request_rejected
export const handleFollowRequestRejected = async ({ actor, targetUserId }) => {
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
};


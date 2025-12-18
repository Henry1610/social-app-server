import prisma from '../../../utils/prisma.js';
import { createNotification } from '../../../services/notificationService.js';

// Handler cho event comment_created
export const handleCommentCreated = async ({ actor, postId, postUserId }) => {
  try {
    // Kiểm tra nếu người comment chính là chủ post thì không gửi notification
    if (!postUserId || postUserId === actor.id) {
      return;
    }

    await createNotification({
      userId: postUserId,
      actorId: actor.id,
      type: "COMMENT",
      targetType: "POST",
      targetId: postId,
    });
  } catch (error) {
    console.error("Error in comment_created event:", error);
  }
};

// Handler cho event repost_created
export const handleRepostCreated = async ({ actor, postId, postUserId }) => {
  try {
    // Kiểm tra nếu người repost chính là chủ post thì không gửi notification
    if (!postUserId || postUserId === actor.id) {
      return;
    }

    await createNotification({
      userId: postUserId,
      actorId: actor.id,
      type: "REPOST",
      targetType: "POST",
      targetId: postId,
    });
  } catch (error) {
    console.error("Error in repost_created event:", error);
  }
};

// Handler cho event reaction_created
export const handleReactionCreated = async ({ actor, targetId, targetType }) => {
  try {
    let targetUserId = null;

    if (targetType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: { userId: true }
      });
      targetUserId = post?.userId;
    } else if (targetType === "COMMENT") {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { userId: true }
      });
      targetUserId = comment?.userId;
    }

    if (!targetUserId || targetUserId === actor.id) {
      return;
    }

    await createNotification({
      userId: targetUserId,
      actorId: actor.id,
      type: "REACTION",
      targetType: targetType,
      targetId: targetId,
    });
  } catch (error) {
    console.error("Error in reaction_created event:", error);
  }
};

// Handler cho event reply_created
export const handleReplyCreated = async ({ actor, commentId, parentCommentUserId, postId, repostId }) => {
  try {
    // Kiểm tra nếu người reply chính là chủ comment thì không gửi notification
    if (!parentCommentUserId || parentCommentUserId === actor.id) {
      return;
    }

    // Lưu postId/repostId vào metadata để frontend có thể navigate
    const metadata = {};
    if (postId) {
      metadata.postId = postId;
    }
    if (repostId) {
      metadata.repostId = repostId;
    }

    await createNotification({
      userId: parentCommentUserId,
      actorId: actor.id,
      type: "REPLY",
      targetType: "COMMENT",
      targetId: commentId,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  } catch (error) {
    console.error("Error in reply_created event:", error);
  }
};


import EventEmitter from "events";
import { createNotification } from "../../services/notificationService.js";
import prisma from "../../utils/prisma.js";

export const postEvents = new EventEmitter();

postEvents.on("comment_created", async ({ actor, postId }) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true }
    });

    if (!post || post.userId === actor.id) {
      return;
    }

    await createNotification({
      userId: post.userId,
      actorId: actor.id,
      type: "COMMENT",
      targetType: "POST",
      targetId: postId,
    });
  } catch (error) {
    console.error("Error in comment_created event:", error);
  }
});
postEvents.on("repost_created", async ({ actor, postId }) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true }
    });

    if (!post || post.userId === actor.id) {
      return;
    }

    await createNotification({
      userId: post.userId,
      actorId: actor.id,
      type: "REPOST",
      targetType: "POST",
      targetId: postId,
    });
  } catch (error) {
    console.error("Error in repost_created event:", error);
  }
});
postEvents.on("reaction_created", async ({ actor, targetId, targetType }) => {
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
});

postEvents.on("reply_created", async ({ actor, commentId, postId }) => {
  try {
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        userId: true,
        postId: true,
        repostId: true
      }
    });

    if (!parentComment || parentComment.userId === actor.id) {
      return;
    }

    // Lưu postId/repostId vào metadata để frontend có thể navigate
    const metadata = {};
    if (parentComment.postId) {
      metadata.postId = parentComment.postId;
    } else if (parentComment.repostId) {
      metadata.repostId = parentComment.repostId;
    }
    await createNotification({
      userId: parentComment.userId,
      actorId: actor.id,
      type: "REPLY",
      targetType: "COMMENT",
      targetId: commentId,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  } catch (error) {
    console.error("Error in reply_created event:", error);
  }
});


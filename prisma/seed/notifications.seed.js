import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

export const seedNotifications = async () => {
  console.log(' Seeding notifications...');

  // Lấy tất cả users
  const users = await prisma.user.findMany({
    select: { id: true }
  });

  if (users.length === 0) {
    console.log(' No users found. Please seed users first.');
    return;
  }

  // Lấy tất cả posts
  const posts = await prisma.post.findMany({
    select: { id: true, userId: true }
  });

  // Lấy tất cả reposts
  const reposts = await prisma.repost.findMany({
    select: { id: true, userId: true, postId: true }
  });

  // Lấy tất cả comments
  const comments = await prisma.comment.findMany({
    select: { id: true, userId: true, postId: true, repostId: true, parentId: true }
  });

  // Lấy tất cả reactions
  const reactions = await prisma.reaction.findMany({
    select: { id: true, userId: true, targetType: true, targetId: true }
  });

  // Lấy tất cả follows
  const follows = await prisma.follow.findMany({
    select: { followerId: true, followingId: true, createdAt: true }
  });

  // Lấy tất cả follow requests
  const followRequests = await prisma.followRequest.findMany({
    select: { id: true, fromUserId: true, toUserId: true, createdAt: true }
  });

  // Lấy tất cả messages
  const messages = await prisma.message.findMany({
    select: { id: true, senderId: true, conversationId: true },
    where: {
      isSystem: false,
      deletedAt: null
    }
  });

  // Lấy conversations để map message với conversation
  const conversations = await prisma.conversation.findMany({
    select: { id: true, members: { select: { userId: true } } }
  });

  console.log(` Found ${posts.length} posts, ${reposts.length} reposts, ${comments.length} comments, ${reactions.length} reactions, ${follows.length} follows, ${followRequests.length} follow requests, ${messages.length} messages`);

  let totalNotifications = 0;
  let reactionNotifications = 0;
  let commentNotifications = 0;
  let replyNotifications = 0;
  let repostNotifications = 0;
  let followNotifications = 0;
  let followRequestNotifications = 0;
  let followAcceptedNotifications = 0;
  let messageNotifications = 0;

  // 1. Tạo notifications cho reactions (REACTION)
  for (const reaction of reactions) {
    // Tìm owner của target
    let targetOwnerId = null;
    
    if (reaction.targetType === 'POST') {
      const post = posts.find(p => p.id === reaction.targetId);
      if (post && post.userId !== reaction.userId) {
        targetOwnerId = post.userId;
      }
    } else if (reaction.targetType === 'REPOST') {
      const repost = reposts.find(r => r.id === reaction.targetId);
      if (repost && repost.userId !== reaction.userId) {
        targetOwnerId = repost.userId;
      }
    } else if (reaction.targetType === 'COMMENT') {
      const comment = comments.find(c => c.id === reaction.targetId);
      if (comment && comment.userId !== reaction.userId) {
        targetOwnerId = comment.userId;
      }
    }

    if (targetOwnerId) {
      try {
        await prisma.notification.create({
          data: {
            userId: targetOwnerId,
            actorId: reaction.userId,
            type: 'REACTION',
            targetType: reaction.targetType,
            targetId: reaction.targetId,
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalNotifications++;
        reactionNotifications++;
      } catch (error) {
        // Ignore duplicate errors
      }
    }
  }

  // 2. Tạo notifications cho comments (COMMENT)
  for (const comment of comments) {
    if (!comment.parentId) { // Chỉ comment gốc, không phải reply
      let targetOwnerId = null;
      let targetType = null;
      let targetId = null;

      if (comment.repostId) {
        const repost = reposts.find(r => r.id === comment.repostId);
        if (repost && repost.userId !== comment.userId) {
          targetOwnerId = repost.userId;
          targetType = 'REPOST';
          targetId = comment.repostId;
        }
      } else if (comment.postId) {
        const post = posts.find(p => p.id === comment.postId);
        if (post && post.userId !== comment.userId) {
          targetOwnerId = post.userId;
          targetType = 'POST';
          targetId = comment.postId;
        }
      }

      if (targetOwnerId) {
        try {
          await prisma.notification.create({
            data: {
              userId: targetOwnerId,
              actorId: comment.userId,
              type: 'COMMENT',
              targetType: targetType,
              targetId: targetId,
              createdAt: faker.date.past({ years: 1 }),
            },
          });
          totalNotifications++;
          commentNotifications++;
        } catch (error) {
          // Ignore duplicate errors
        }
      }
    }
  }

  // 3. Tạo notifications cho replies (REPLY)
  for (const comment of comments) {
    if (comment.parentId) { // Là reply
      const parentComment = comments.find(c => c.id === comment.parentId);
      if (parentComment && parentComment.userId !== comment.userId) {
        try {
          await prisma.notification.create({
            data: {
              userId: parentComment.userId,
              actorId: comment.userId,
              type: 'REPLY',
              targetType: 'COMMENT',
              targetId: comment.parentId,
              createdAt: faker.date.past({ years: 1 }),
            },
          });
          totalNotifications++;
          replyNotifications++;
        } catch (error) {
          // Ignore duplicate errors
        }
      }
    }
  }

  // 4. Tạo notifications cho reposts (REPOST)
  for (const repost of reposts) {
    const originalPost = posts.find(p => p.id === repost.postId);
    if (originalPost && originalPost.userId !== repost.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: originalPost.userId,
            actorId: repost.userId,
            type: 'REPOST',
            targetType: 'POST',
            targetId: repost.postId,
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalNotifications++;
        repostNotifications++;
      } catch (error) {
        // Ignore duplicate errors
      }
    }
  }

  // 5. Tạo notifications cho follows (FOLLOW)
  for (const follow of follows) {
    try {
      await prisma.notification.create({
        data: {
          userId: follow.followingId,
          actorId: follow.followerId,
          type: 'FOLLOW',
          targetType: 'USER',
          targetId: follow.followerId,
          createdAt: follow.createdAt,
        },
      });
      totalNotifications++;
      followNotifications++;
    } catch (error) {
      // Ignore duplicate errors
    }
  }

  // 6. Tạo notifications cho follow requests (FOLLOW_REQUEST)
  for (const followRequest of followRequests) {
    try {
      await prisma.notification.create({
        data: {
          userId: followRequest.toUserId,
          actorId: followRequest.fromUserId,
          type: 'FOLLOW_REQUEST',
          targetType: 'USER',
          targetId: followRequest.fromUserId,
          createdAt: followRequest.createdAt,
        },
      });
      totalNotifications++;
      followRequestNotifications++;
    } catch (error) {
      // Ignore duplicate errors
    }
  }

  // 7. Tạo notifications cho follow accepted (FOLLOW_ACCEPTED) - một số follow requests được accept
  // Lấy một số follow requests ngẫu nhiên để accept
  const acceptedRequests = faker.helpers.arrayElements(followRequests, Math.floor(followRequests.length * 0.3));
  for (const request of acceptedRequests) {
    try {
      await prisma.notification.create({
        data: {
          userId: request.fromUserId,
          actorId: request.toUserId,
          type: 'FOLLOW_ACCEPTED',
          targetType: 'USER',
          targetId: request.toUserId,
          createdAt: faker.date.past({ years: 1 }),
        },
      });
      totalNotifications++;
      followAcceptedNotifications++;
    } catch (error) {
      // Ignore duplicate errors
    }
  }

  // 8. Tạo notifications cho messages (MESSAGE)
  for (const message of messages) {
    const conversation = conversations.find(c => c.id === message.conversationId);
    if (conversation && conversation.members) {
      // Gửi notification cho tất cả members trong conversation (trừ người gửi)
      const recipients = conversation.members
        .filter(m => m.userId !== message.senderId)
        .map(m => m.userId);

      for (const recipientId of recipients) {
        try {
          await prisma.notification.create({
            data: {
              userId: recipientId,
              actorId: message.senderId,
              type: 'MESSAGE',
              targetType: 'CONVERSATION',
              targetId: message.conversationId,
              createdAt: faker.date.past({ years: 1 }),
            },
          });
          totalNotifications++;
          messageNotifications++;
        } catch (error) {
          // Ignore duplicate errors
        }
      }
    }
  }

  console.log(` Created ${totalNotifications} notifications:`);
  console.log(`  - ${reactionNotifications} reaction notifications`);
  console.log(`  - ${commentNotifications} comment notifications`);
  console.log(`  - ${replyNotifications} reply notifications`);
  console.log(`  - ${repostNotifications} repost notifications`);
  console.log(`  - ${followNotifications} follow notifications`);
  console.log(`  - ${followRequestNotifications} follow request notifications`);
  console.log(`  - ${followAcceptedNotifications} follow accepted notifications`);
  console.log(`  - ${messageNotifications} message notifications`);
};


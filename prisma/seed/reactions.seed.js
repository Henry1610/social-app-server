import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Các loại reaction cho comments và messages (có thể dùng nhiều loại)
const COMMENT_REACTION_TYPES = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];
const MESSAGE_REACTION_TYPES = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];

export const seedReactions = async () => {
  console.log(' Seeding reactions...');

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
    select: { id: true, userId: true }
  });

  // Lấy tất cả comments
  const comments = await prisma.comment.findMany({
    select: { id: true, userId: true }
  });

  // Lấy tất cả messages
  const messages = await prisma.message.findMany({
    select: { id: true, senderId: true, conversationId: true },
    where: {
      isSystem: false,
      deletedAt: null
    }
  });

  if (posts.length === 0 && reposts.length === 0 && comments.length === 0 && messages.length === 0) {
    console.log(' No posts, reposts, comments or messages found. Please seed posts, reposts, comments and conversations first.');
    return;
  }

  console.log(` Found ${posts.length} posts, ${reposts.length} reposts, ${comments.length} comments, ${messages.length} messages`);

  let totalReactions = 0;
  let postReactions = 0;
  let repostReactions = 0;
  let commentReactions = 0;
  let messageReactions = 0;

  // Tạo reactions cho posts (chỉ LIKE)
  for (const post of posts) {
    // 60-80% users sẽ like post này
    const likeCount = Math.floor(users.length * faker.number.float({ min: 0.6, max: 0.8 }));
    const usersToLike = faker.helpers.arrayElements(
      users.filter(u => u.id !== post.userId), 
      Math.min(likeCount, users.length - 1)
    );

    for (const user of usersToLike) {
      try {
        await prisma.reaction.create({
          data: {
            userId: user.id,
            targetType: 'POST',
            targetId: post.id,
            reactionType: 'LIKE',
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalReactions++;
        postReactions++;
      } catch (error) {
        // Bỏ qua nếu đã có reaction (unique constraint)
        if (error.code !== 'P2002') {
          console.error('Error creating post reaction:', error);
        }
      }
    }
  }

  // Tạo reactions cho reposts (chỉ LIKE)
  for (const repost of reposts) {
    // 50-70% users sẽ like repost này
    const likeCount = Math.floor(users.length * faker.number.float({ min: 0.5, max: 0.7 }));
    const usersToLike = faker.helpers.arrayElements(
      users.filter(u => u.id !== repost.userId), 
      Math.min(likeCount, users.length - 1)
    );

    for (const user of usersToLike) {
      try {
        await prisma.reaction.create({
          data: {
            userId: user.id,
            targetType: 'REPOST',
            targetId: repost.id,
            reactionType: 'LIKE',
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalReactions++;
        repostReactions++;
      } catch (error) {
        // Bỏ qua nếu đã có reaction (unique constraint)
        if (error.code !== 'P2002') {
          console.error('Error creating repost reaction:', error);
        }
      }
    }
  }

  // Tạo reactions cho comments (có thể dùng nhiều loại reaction)
  for (const comment of comments) {
    // 30-50% comments sẽ có reactions
    if (!faker.datatype.boolean({ probability: 0.4 })) continue;

    // Mỗi comment có 2-10 reactions
    const reactionCount = faker.number.int({ min: 2, max: 10 });
    const usersToReact = faker.helpers.arrayElements(
      users.filter(u => u.id !== comment.userId), 
      Math.min(reactionCount, users.length - 1)
    );

    for (const user of usersToReact) {
      try {
        await prisma.reaction.create({
          data: {
            userId: user.id,
            targetType: 'COMMENT',
            targetId: comment.id,
            reactionType: faker.helpers.arrayElement(COMMENT_REACTION_TYPES),
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalReactions++;
        commentReactions++;
      } catch (error) {
        // Bỏ qua nếu đã có reaction (unique constraint)
        if (error.code !== 'P2002') {
          console.error('Error creating comment reaction:', error);
        }
      }
    }
  }

  // Tạo reactions cho messages (có thể dùng nhiều loại reaction)
  // Lấy danh sách conversation members để biết ai có thể react
  const conversationMembersMap = new Map();
  
  if (messages.length > 0) {
    // Lấy tất cả unique conversation IDs
    const conversationIds = [...new Set(messages.map(m => m.conversationId))];
    
    // Lấy tất cả members của các conversations này một lần
    const allMembers = await prisma.conversationMember.findMany({
      where: { 
        conversationId: { in: conversationIds },
        leftAt: null
      },
      select: { conversationId: true, userId: true }
    });
    
    // Group members theo conversationId
    for (const member of allMembers) {
      if (!conversationMembersMap.has(member.conversationId)) {
        conversationMembersMap.set(member.conversationId, []);
      }
      conversationMembersMap.get(member.conversationId).push(member.userId);
    }
  }

  for (const message of messages) {
    // 20-40% messages sẽ có reactions
    if (!faker.datatype.boolean({ probability: 0.3 })) continue;

    // Chỉ những người trong conversation (không phải người gửi) mới có thể react
    const conversationMembers = conversationMembersMap.get(message.conversationId) || [];
    const usersCanReact = users.filter(u => 
      u.id !== message.senderId && conversationMembers.includes(u.id)
    );

    if (usersCanReact.length === 0) continue;

    // Mỗi message có 1-5 reactions
    const reactionCount = faker.number.int({ min: 1, max: 5 });
    const usersToReact = faker.helpers.arrayElements(
      usersCanReact, 
      Math.min(reactionCount, usersCanReact.length)
    );

    for (const user of usersToReact) {
      try {
        await prisma.reaction.create({
          data: {
            userId: user.id,
            targetType: 'MESSAGE',
            targetId: message.id,
            reactionType: faker.helpers.arrayElement(MESSAGE_REACTION_TYPES),
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalReactions++;
        messageReactions++;
      } catch (error) {
        // Bỏ qua nếu đã có reaction (unique constraint)
        if (error.code !== 'P2002') {
          console.error('Error creating message reaction:', error);
        }
      }
    }
  }

  console.log(` Created ${totalReactions} reactions:`);
  console.log(`  - ${postReactions} post reactions`);
  console.log(`  - ${repostReactions} repost reactions`);
  console.log(`  - ${commentReactions} comment reactions`);
  console.log(`  - ${messageReactions} message reactions`);
};


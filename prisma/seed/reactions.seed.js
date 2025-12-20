import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

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

  if (posts.length === 0 && reposts.length === 0) {
    console.log(' No posts or reposts found. Please seed posts and reposts first.');
    return;
  }

  console.log(` Found ${posts.length} posts, ${reposts.length} reposts`);

  let totalReactions = 0;

  // Tạo reactions cho posts (chỉ LIKE)
  for (const post of posts) {
    // 60-80% users sẽ like post này
    const likeCount = Math.floor(users.length * faker.number.float({ min: 0.6, max: 0.8 }));
    const usersToLike = faker.helpers.arrayElements(users, Math.min(likeCount, users.length));

    for (const user of usersToLike) {
      // Bỏ qua nếu user là chủ post
      if (user.id === post.userId) continue;

      try {
        await prisma.reaction.create({
          data: {
            userId: user.id,
            targetType: 'POST',
            targetId: post.id,
            reactionType: 'LIKE',
          },
        });
        totalReactions++;
      } catch (error) {
        // Bỏ qua nếu đã có reaction (unique constraint)
        if (error.code !== 'P2002') {
          console.error('Error creating reaction:', error);
        }
      }
    }
  }

  // Tạo reactions cho reposts (chỉ LIKE)
  for (const repost of reposts) {
    // 50-70% users sẽ like repost này
    const likeCount = Math.floor(users.length * faker.number.float({ min: 0.5, max: 0.7 }));
    const usersToLike = faker.helpers.arrayElements(users, Math.min(likeCount, users.length));

    for (const user of usersToLike) {
      // Bỏ qua nếu user là chủ repost
      if (user.id === repost.userId) continue;

      try {
        await prisma.reaction.create({
          data: {
            userId: user.id,
            targetType: 'REPOST',
            targetId: repost.id,
            reactionType: 'LIKE',
          },
        });
        totalReactions++;
      } catch (error) {
        // Bỏ qua nếu đã có reaction (unique constraint)
        if (error.code !== 'P2002') {
          console.error('Error creating reaction:', error);
        }
      }
    }
  }

  console.log(` Created ${totalReactions} reactions`);
};


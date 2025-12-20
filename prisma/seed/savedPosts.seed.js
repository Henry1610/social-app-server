import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

export const seedSavedPosts = async () => {
  console.log(' Seeding saved posts...');

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
    select: { id: true }
  });

  if (posts.length === 0) {
    console.log(' No posts found. Please seed posts first.');
    return;
  }

  console.log(` Found ${users.length} users, ${posts.length} posts`);

  let totalSaved = 0;

  // Tạo saved posts cho mỗi user
  for (const user of users) {
    // Mỗi user sẽ save 5-15 posts
    const saveCount = faker.number.int({ min: 5, max: 15 });
    const postsToSave = faker.helpers.arrayElements(posts, Math.min(saveCount, posts.length));

    for (const post of postsToSave) {
      // Kiểm tra xem user đã save post này chưa
      const existing = await prisma.savedPost.findUnique({
        where: {
          userId_postId: {
            userId: user.id,
            postId: post.id,
          },
        },
      });

      if (existing) {
        continue; // Bỏ qua nếu đã save
      }

      try {
        await prisma.savedPost.create({
          data: {
            userId: user.id,
            postId: post.id,
            savedAt: faker.date.past({ years: 1 }),
          },
        });
        totalSaved++;
      } catch (error) {
        console.error('Error creating saved post:', error);
      }
    }
  }

  console.log(` Created ${totalSaved} saved posts`);
};


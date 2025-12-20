import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Mảng câu comment khi repost tiếng Việt
const VIETNAMESE_REPOST_COMMENTS = [
  'Bài viết hay quá!',
  'Đồng ý với bài này',
  'Chia sẻ cho mọi người',
  'Rất hữu ích!',
  'Tuyệt vời!',
  'Hay lắm!',
  'Đúng quá!',
  'Cảm ơn bạn đã chia sẻ',
  'Quá hay!',
  'Tuyệt!',
];

export const seedReposts = async () => {
  console.log(' Seeding reposts...');

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

  if (posts.length === 0) {
    console.log(' No posts found. Please seed posts first.');
    return;
  }

  console.log(` Found ${posts.length} posts`);

  let totalReposts = 0;

  // Tạo reposts
  for (const post of posts) {
    // 20-40% posts sẽ được repost
    if (!faker.datatype.boolean({ probability: 0.3 })) continue;

    // Mỗi post có 1-5 reposts
    const repostCount = faker.number.int({ min: 1, max: 5 });
    const reposters = faker.helpers.arrayElements(users, Math.min(repostCount, users.length));

    for (const user of reposters) {
      // Bỏ qua nếu user là chủ post
      if (user.id === post.userId) continue;

      // Kiểm tra xem user đã repost post này chưa
      const existing = await prisma.repost.findUnique({
        where: {
          userId_postId: {
            userId: user.id,
            postId: post.id,
          },
        },
      });

      if (existing) {
        continue; // Bỏ qua nếu đã repost
      }

      try {
        // 50% reposts có comment, 50% không có
        const hasComment = faker.datatype.boolean({ probability: 0.5 });

        await prisma.repost.create({
          data: {
            userId: user.id,
            postId: post.id,
            content: hasComment ? faker.helpers.arrayElement(VIETNAMESE_REPOST_COMMENTS) : null,
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalReposts++;
      } catch (error) {
        console.error('Error creating repost:', error);
      }
    }
  }

  console.log(` Created ${totalReposts} reposts`);
};


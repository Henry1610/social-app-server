import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Mảng câu comment tiếng Việt
const VIETNAMESE_COMMENTS = [
  'Bài viết hay quá! ',
  'Tuyệt vời!',
  'Đồng ý với bạn',
  'Cảm ơn bạn đã chia sẻ',
  'Rất hữu ích!',
  'Tôi cũng nghĩ vậy',
  'Quá đúng luôn ',
  'Hay quá đi',
  'Chia sẻ thêm đi bạn',
  'Tuyệt vời quá!',
  'Cảm ơn bạn',
  'Đúng rồi đó',
  'Tôi đồng ý',
  'Hay lắm!',
  'Rất thú vị',
  'Tuyệt!',
  'Quá hay!',
  'Đúng vậy',
  'Cảm ơn',
  'Tuyệt vời quá!',
  'Rất hay',
  'Đồng ý',
  'Tốt lắm',
  'Hay quá',
  'Tuyệt',
];

// Hàm tạo comment ngẫu nhiên
const generateComment = () => {
  // 80% dùng comment có sẵn, 20% tạo ngẫu nhiên
  if (faker.datatype.boolean({ probability: 0.8 })) {
    return faker.helpers.arrayElement(VIETNAMESE_COMMENTS);
  }
  // Tạo comment ngẫu nhiên từ các câu ngắn
  const phrases = [
    'Bài viết', 'Rất', 'Tuyệt', 'Hay', 'Đúng', 'Cảm ơn', 'Đồng ý', 'Tốt', 'Quá'
  ];
  return `${faker.helpers.arrayElement(phrases)} ${faker.helpers.arrayElement(phrases).toLowerCase()}!`;
};

export const seedComments = async () => {
  console.log(' Seeding comments...');

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
    console.log(' No posts or reposts found. Please seed posts first.');
    return;
  }

  console.log(` Found ${posts.length} posts, ${reposts.length} reposts`);

  let totalComments = 0;
  let totalReplies = 0;

  // Tạo comments cho posts
  for (const post of posts) {
    // 40-70% posts sẽ có comments
    if (!faker.datatype.boolean({ probability: 0.6 })) continue;

    // Mỗi post có 2-8 comments
    const commentCount = faker.number.int({ min: 2, max: 8 });
    const commenters = faker.helpers.arrayElements(users, Math.min(commentCount, users.length));

    const postComments = [];

    for (const user of commenters) {
      // Bỏ qua nếu user là chủ post (có thể comment nhưng để đơn giản bỏ qua)
      if (user.id === post.userId) continue;

      try {
        const comment = await prisma.comment.create({
          data: {
            postId: post.id,
            userId: user.id,
            content: generateComment(),
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        postComments.push(comment);
        totalComments++;
      } catch (error) {
        console.error('Error creating comment:', error);
      }
    }

    // Tạo replies cho một số comments (30% comments sẽ có replies)
    for (const comment of postComments) {
      if (!faker.datatype.boolean({ probability: 0.3 })) continue;

      // Mỗi comment có 1-3 replies
      const replyCount = faker.number.int({ min: 1, max: 3 });
      const repliers = faker.helpers.arrayElements(users, Math.min(replyCount, users.length));

      for (const user of repliers) {
        // Bỏ qua nếu user là người comment gốc
        if (user.id === comment.userId) continue;

        try {
          await prisma.comment.create({
            data: {
              postId: post.id,
              userId: user.id,
              parentId: comment.id,
              content: generateComment(),
              createdAt: faker.date.past({ years: 1 }),
            },
          });
          totalReplies++;
        } catch (error) {
          console.error('Error creating reply:', error);
        }
      }
    }
  }

  // Tạo comments cho reposts
  for (const repost of reposts) {
    // 30-60% reposts sẽ có comments
    if (!faker.datatype.boolean({ probability: 0.5 })) continue;

    // Mỗi repost có 1-5 comments
    const commentCount = faker.number.int({ min: 1, max: 5 });
    const commenters = faker.helpers.arrayElements(users, Math.min(commentCount, users.length));

    for (const user of commenters) {
      // Bỏ qua nếu user là chủ repost
      if (user.id === repost.userId) continue;

      try {
        await prisma.comment.create({
          data: {
            repostId: repost.id,
            userId: user.id,
            content: generateComment(),
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalComments++;
      } catch (error) {
        console.error('Error creating comment:', error);
      }
    }
  }

  console.log(` Created ${totalComments} comments with ${totalReplies} replies`);
};


import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const PRIVACY_OPTIONS = ['everyone', 'followers', 'nobody'];

// Hàm tạo URL ảnh từ Picsum Photos API
const generateImageUrl = () => {
  // Kích thước ngẫu nhiên từ 600-1200px
  const width = faker.number.int({ min: 600, max: 1200 });
  const height = faker.number.int({ min: 600, max: 1200 });
  // Thêm seed ngẫu nhiên để mỗi ảnh khác nhau
  const seed = faker.number.int({ min: 1, max: 1000 });
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
};

// Hàm tạo URL video từ các video mẫu công khai
const generateVideoUrl = () => {
  // Sử dụng video mẫu từ các nguồn công khai
  // Big Buck Bunny, Sintel, và các video mẫu khác
  const videoSources = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreet.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  ];
  
  return faker.helpers.arrayElement(videoSources);
};

export const seedPosts = async () => {
  console.log(' Seeding posts...');

  // Lấy tất cả users
  const users = await prisma.user.findMany({
    select: { id: true }
  });

  if (users.length === 0) {
    console.log(' No users found. Please seed users first.');
    return;
  }

  console.log(` Found ${users.length} users`);

  let totalPosts = 0;
  let totalMedia = 0;

  // Tạo 5-10 posts cho mỗi user
  for (const user of users) {
    const postCount = faker.number.int({ min: 5, max: 10 });

    for (let i = 0; i < postCount; i++) {
      // Tạo post
      const post = await prisma.post.create({
        data: {
          userId: user.id,
          content: faker.lorem.paragraphs({ min: 1, max: 3 }),
          whoCanSee: faker.helpers.arrayElement(PRIVACY_OPTIONS),
          whoCanComment: faker.helpers.arrayElement(PRIVACY_OPTIONS),
          createdAt: faker.date.past({ years: 1 }),
        },
      });

      totalPosts++;

      // 70% posts có media
      if (faker.datatype.boolean({ probability: 0.7 })) {
        const mediaCount = faker.number.int({ min: 1, max: 4 });
        const mediaType = faker.helpers.arrayElement(['image', 'video']);

        const mediaData = [];
        for (let j = 0; j < mediaCount; j++) {
          mediaData.push({
            postId: post.id,
            mediaUrl: mediaType === 'image' 
              ? generateImageUrl()
              : generateVideoUrl(),
            mediaType: mediaType,
          });
        }

        await prisma.postMedia.createMany({
          data: mediaData,
        });

        totalMedia += mediaData.length;
      }
    }

    // Log progress mỗi 10 users
    if ((users.indexOf(user) + 1) % 10 === 0) {
      console.log(`Processed ${users.indexOf(user) + 1}/${users.length} users`);
    }
  }

  console.log(`Created ${totalPosts} posts with ${totalMedia} media files`);
};
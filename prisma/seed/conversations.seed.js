import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// Mảng tin nhắn tiếng Việt
const VIETNAMESE_MESSAGES = [
  'Xin chào!',
  'Bạn khỏe không?',
  'Hôm nay thế nào?',
  'Cảm ơn bạn',
  'Không có gì',
  'Được rồi',
  'OK',
  'Tốt lắm',
  'Hay quá',
  'Tuyệt vời',
  'Đồng ý',
  'Tôi cũng nghĩ vậy',
  'Đúng rồi',
  'Có thể',
  'Chắc chắn',
  'Tốt',
  'Ổn',
  'Được',
  'Vâng',
  'Dạ',
  'Haha',
  'Vui quá',
  'Thú vị',
  'Cảm ơn bạn đã chia sẻ',
  'Rất hữu ích',
];

// Hàm tạo tin nhắn ngẫu nhiên
const generateMessage = () => {
  // 70% dùng message có sẵn, 30% tạo ngẫu nhiên
  if (faker.datatype.boolean({ probability: 0.7 })) {
    return faker.helpers.arrayElement(VIETNAMESE_MESSAGES);
  }
  // Tạo message ngẫu nhiên từ các từ
  const words = ['Xin', 'chào', 'Bạn', 'khỏe', 'không', 'Tốt', 'lắm', 'Cảm', 'ơn', 'Được', 'rồi'];
  const wordCount = faker.number.int({ min: 2, max: 5 });
  return faker.helpers.arrayElements(words, wordCount).join(' ') + '.';
};

export const seedConversations = async () => {
  console.log(' Seeding conversations and messages...');

  // Lấy tất cả users
  const users = await prisma.user.findMany({
    select: { id: true }
  });

  if (users.length < 2) {
    console.log(' Need at least 2 users to create conversations. Please seed users first.');
    return;
  }

  console.log(` Found ${users.length} users`);

  let totalConversations = 0;
  let totalMessages = 0;

  // Tạo DIRECT conversations (1-1 chat)
  // Tạo 30-50% số lượng có thể (n*(n-1)/2)
  const maxDirectConversations = Math.floor((users.length * (users.length - 1)) / 2);
  const directCount = Math.floor(maxDirectConversations * faker.number.float({ min: 0.3, max: 0.5 }));

  const createdDirectConversations = new Set();

  for (let i = 0; i < directCount; i++) {
    const [user1, user2] = faker.helpers.arrayElements(users, 2);
    const key1 = `${user1.id}-${user2.id}`;
    const key2 = `${user2.id}-${user1.id}`;

    // Kiểm tra xem đã tạo conversation giữa 2 users này chưa
    if (createdDirectConversations.has(key1) || createdDirectConversations.has(key2)) {
      continue;
    }

    createdDirectConversations.add(key1);
    createdDirectConversations.add(key2);

    try {
      // Tạo conversation
      const conversation = await prisma.conversation.create({
        data: {
          type: 'DIRECT',
          createdAt: faker.date.past({ years: 1 }),
        },
      });

      // Thêm members
      await prisma.conversationMember.createMany({
        data: [
          {
            conversationId: conversation.id,
            userId: user1.id,
            joinedAt: faker.date.past({ years: 1 }),
          },
          {
            conversationId: conversation.id,
            userId: user2.id,
            joinedAt: faker.date.past({ years: 1 }),
          },
        ],
      });

      totalConversations++;

      // Tạo messages cho conversation này (5-20 messages)
      const messageCount = faker.number.int({ min: 5, max: 20 });
      let lastMessageAt = null;

      for (let j = 0; j < messageCount; j++) {
        const sender = faker.helpers.arrayElement([user1, user2]);
        const messageType = faker.helpers.arrayElement(['TEXT', 'TEXT', 'TEXT', 'TEXT', 'IMAGE', 'VIDEO']); // 80% TEXT, 20% media

        let messageData = {
          conversationId: conversation.id,
          senderId: sender.id,
          type: messageType,
          createdAt: faker.date.past({ years: 1 }),
        };

        if (messageType === 'TEXT') {
          messageData.content = generateMessage();
        } else if (messageType === 'IMAGE') {
          const width = faker.number.int({ min: 600, max: 1200 });
          const height = faker.number.int({ min: 600, max: 1200 });
          const seed = faker.number.int({ min: 1, max: 1000 });
          messageData.mediaUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
          messageData.mediaType = 'image/jpeg';
        } else if (messageType === 'VIDEO') {
          const videoSources = [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
          ];
          messageData.mediaUrl = faker.helpers.arrayElement(videoSources);
          messageData.mediaType = 'video/mp4';
        }

        const message = await prisma.message.create({
          data: messageData,
        });

        lastMessageAt = message.createdAt;
        totalMessages++;
      }

      // Cập nhật lastMessageAt cho conversation
      if (lastMessageAt) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt },
        });
      }
    } catch (error) {
      console.error('Error creating direct conversation:', error);
    }
  }

  // Tạo GROUP conversations (nhóm chat)
  // Tạo 5-10 group conversations
  const groupCount = faker.number.int({ min: 5, max: 10 });

  for (let i = 0; i < groupCount; i++) {
    // Mỗi group có 3-8 members
    const memberCount = faker.number.int({ min: 3, max: 8 });
    const groupMembers = faker.helpers.arrayElements(users, Math.min(memberCount, users.length));
    const creator = groupMembers[0];

    try {
      // Tạo conversation
      const conversation = await prisma.conversation.create({
        data: {
          type: 'GROUP',
          name: `Nhóm ${faker.helpers.arrayElement(['Bạn bè', 'Gia đình', 'Đồng nghiệp', 'Học tập', 'Vui vẻ'])} ${i + 1}`,
          createdBy: creator.id,
          createdAt: faker.date.past({ years: 1 }),
        },
      });

      // Thêm members
      const membersData = groupMembers.map((member, index) => ({
        conversationId: conversation.id,
        userId: member.id,
        role: index === 0 ? 'ADMIN' : 'MEMBER',
        joinedAt: faker.date.past({ years: 1 }),
      }));

      await prisma.conversationMember.createMany({
        data: membersData,
      });

      totalConversations++;

      // Tạo messages cho group (10-30 messages)
      const messageCount = faker.number.int({ min: 10, max: 30 });
      let lastMessageAt = null;

      for (let j = 0; j < messageCount; j++) {
        const sender = faker.helpers.arrayElement(groupMembers);
        const messageType = faker.helpers.arrayElement(['TEXT', 'TEXT', 'TEXT', 'TEXT', 'IMAGE', 'VIDEO']);

        let messageData = {
          conversationId: conversation.id,
          senderId: sender.id,
          type: messageType,
          createdAt: faker.date.past({ years: 1 }),
        };

        if (messageType === 'TEXT') {
          messageData.content = generateMessage();
        } else if (messageType === 'IMAGE') {
          const width = faker.number.int({ min: 600, max: 1200 });
          const height = faker.number.int({ min: 600, max: 1200 });
          const seed = faker.number.int({ min: 1, max: 1000 });
          messageData.mediaUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
          messageData.mediaType = 'image/jpeg';
        } else if (messageType === 'VIDEO') {
          const videoSources = [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
          ];
          messageData.mediaUrl = faker.helpers.arrayElement(videoSources);
          messageData.mediaType = 'video/mp4';
        }

        const message = await prisma.message.create({
          data: messageData,
        });

        lastMessageAt = message.createdAt;
        totalMessages++;
      }

      // Cập nhật lastMessageAt cho conversation
      if (lastMessageAt) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt },
        });
      }
    } catch (error) {
      console.error('Error creating group conversation:', error);
    }
  }

  console.log(` Created ${totalConversations} conversations with ${totalMessages} messages`);
};


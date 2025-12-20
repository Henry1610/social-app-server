import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const PRIVACY_OPTIONS = ['everyone', 'followers', 'nobody'];

export const seedPrivacySettings = async () => {
  console.log(' Seeding privacy settings...');

  // Lấy tất cả users
  const users = await prisma.user.findMany({
    select: { id: true }
  });

  if (users.length === 0) {
    console.log(' No users found. Please seed users first.');
    return;
  }

  console.log(` Found ${users.length} users`);

  let totalSettings = 0;

  // Tạo privacy settings cho mỗi user
  for (const user of users) {
    // Kiểm tra xem user đã có privacy settings chưa
    const existing = await prisma.userPrivacySetting.findUnique({
      where: { userId: user.id }
    });

    if (existing) {
      continue; // Bỏ qua nếu đã có
    }

    // 20% users có tài khoản private
    const isPrivate = faker.datatype.boolean({ probability: 0.2 });

    await prisma.userPrivacySetting.create({
      data: {
        userId: user.id,
        isPrivate: isPrivate,
        whoCanMessage: faker.helpers.arrayElement(PRIVACY_OPTIONS),
        whoCanTagMe: faker.helpers.arrayElement(PRIVACY_OPTIONS),
        whoCanFindByUsername: faker.helpers.arrayElement(PRIVACY_OPTIONS),
        showOnlineStatus: faker.datatype.boolean({ probability: 0.8 }), // 80% hiển thị online status
      },
    });

    totalSettings++;
  }

  console.log(` Created ${totalSettings} privacy settings`);
};


import { PrismaClient } from '../../generated/prisma/index.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

export const seedFollowRequests = async () => {
  console.log(' Seeding follow requests...');

  // Lấy tất cả users
  const users = await prisma.user.findMany({
    select: { id: true }
  });

  if (users.length === 0) {
    console.log(' No users found. Please seed users first.');
    return;
  }

  // Lấy users có privacy settings là private
  const privateUsers = await prisma.user.findMany({
    where: {
      privacySettings: {
        isPrivate: true,
      },
    },
    select: { id: true },
  });

  if (privateUsers.length === 0) {
    console.log(' No private users found. Skipping follow requests.');
    return;
  }

  console.log(` Found ${privateUsers.length} private users`);

  let totalRequests = 0;

  // Tạo follow requests cho private users
  for (const privateUser of privateUsers) {
    // Mỗi private user sẽ nhận 2-8 follow requests
    const requestCount = faker.number.int({ min: 2, max: 8 });
    const requesters = faker.helpers.arrayElements(
      users.filter(u => u.id !== privateUser.id),
      Math.min(requestCount, users.length - 1)
    );

    for (const requester of requesters) {
      // Kiểm tra xem đã follow chưa
      const alreadyFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: requester.id,
            followingId: privateUser.id,
          },
        },
      });

      if (alreadyFollowing) {
        continue; // Bỏ qua nếu đã follow
      }

      // Kiểm tra xem đã có request chưa
      const existingRequest = await prisma.followRequest.findUnique({
        where: {
          fromUserId_toUserId: {
            fromUserId: requester.id,
            toUserId: privateUser.id,
          },
        },
      });

      if (existingRequest) {
        continue; // Bỏ qua nếu đã có request
      }

      try {
        await prisma.followRequest.create({
          data: {
            fromUserId: requester.id,
            toUserId: privateUser.id,
            createdAt: faker.date.past({ years: 1 }),
          },
        });
        totalRequests++;
      } catch (error) {
        console.error('Error creating follow request:', error);
      }
    }
  }

  console.log(` Created ${totalRequests} follow requests`);
};


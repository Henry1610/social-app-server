import { faker } from "@faker-js/faker";

export async function seedFollows(prisma, users) {
  for (const user of users) {
    const followCount = faker.number.int({ min: 1, max: 8 });

    for (let i = 0; i < followCount; i++) {
      const target = users[Math.floor(Math.random() * users.length)];

      if (target.id !== user.id) {
        await prisma.follow.create({
          data: {
            followerId: user.id,
            followingId: target.id,
          },
        }).catch(() => {});
      }
    }
  }
}

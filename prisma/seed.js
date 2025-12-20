import { PrismaClient } from "../generated/prisma/index.js";
import { seedUsers } from "./seed/users.seed.js";
import { seedFollows } from "./seed/follows.seed.js";
import { seedPosts } from "./seed/posts.seed.js";
import { seedPrivacySettings } from "./seed/privacySettings.seed.js";
import { seedReposts } from "./seed/reposts.seed.js";
import { seedReactions } from "./seed/reactions.seed.js";
import { seedComments } from "./seed/comments.seed.js";
import { seedSavedPosts } from "./seed/savedPosts.seed.js";
import { seedFollowRequests } from "./seed/followRequests.seed.js";
import { seedConversations } from "./seed/conversations.seed.js";
const prisma = new PrismaClient();

async function main() {
  const users = await seedUsers(prisma, 40);
  await seedPrivacySettings();
  await seedFollows(prisma, users);
  await seedFollowRequests();
  await seedPosts();
  await seedReposts();
  await seedReactions();
  await seedComments();
  await seedSavedPosts();
  await seedConversations();
}

main()
  .then(() => console.log(" Seed USER done"))
  .catch(console.error)
  .finally(() => prisma.$disconnect());

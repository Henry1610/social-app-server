import * as userRepository from "../repositories/userRepository.js";
import prisma from "../utils/prisma.js";

/**
 * Tìm kiếm người dùng theo query
 * @param {string} query - Từ khóa tìm kiếm
 * @param {number|null} currentUserId - ID của người dùng hiện tại (null nếu chưa đăng nhập)
 * @returns {Promise<Array>} Mảng các user đã được filter và clean
 */
export const searchUsers = async (query, currentUserId = null) => {
  if (!query || !query.trim()) {
    return [];
  }

  // Note: searchUsers cần complex query với OR và followers relation
  // Tạm thời vẫn dùng prisma trực tiếp, có thể bổ sung vào userRepository sau
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { fullName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      privacySettings: {
        select: {
          whoCanFindByUsername: true,
        },
      },
      ...(currentUserId ? {
        followers: {
          where: { followerId: currentUserId },
          select: { followerId: true },
          take: 1,
        },
      } : {}),
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  // Filter users dựa trên privacy settings
  const filteredUsers = users.filter((user) => {
    // Người dùng hiện tại luôn thấy được chính mình
    if (currentUserId && user.id === currentUserId) {
      return true;
    }

    const whoCanFind = user.privacySettings?.whoCanFindByUsername || "everyone";

    if (whoCanFind === "everyone") {
      return true;
    }

    if (whoCanFind === "nobody") {
      return false;
    }

    if (whoCanFind === "followers") {
      if (currentUserId) {
        return user.followers && user.followers.length > 0;
      }
      return false;
    }

    return true;
  }).slice(0, 10);

  // Loại bỏ privacySettings và followers khỏi mỗi user object
  const cleanUsers = filteredUsers.map(({ privacySettings, followers, ...user }) => user);

  return cleanUsers;
};

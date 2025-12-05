import prisma from "../../utils/prisma.js";
import { addSearchSelection, getSearchHistory, clearSearchHistory, removeSearchItem } from "../../services/redis/searchHistoryService.js";

// GET /api/user/search?q=...
export const searchUsers = async (req, res) => {
  try {
    const query = (req.query.q || req.query.query || "").trim();
    if (!query) {
      return res.json({ success: true, users: [] });
    }

    const currentUserId = req.user.id;

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

    const filteredUsers = users.filter((user) => {
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

    return res.json({ success: true, users: cleanUsers });
  } catch (error) {
    console.error("Search users error:", error);
    return res.status(500).json({ success: false, message: "Tìm kiếm thất bại" });
  }
};

// POST /api/user/search/selection
export const recordSearchSelection = async (req, res) => {
  try {
    const userId = req.user.id;

    const { type, user } = req.body || {};
    if (!type) {
      return res.status(400).json({ success: false, message: "Thiếu type" });
    }

    await addSearchSelection(userId, { type, ...(user ? { id: user.id, username: user.username, fullName: user.fullName, avatarUrl: user.avatarUrl } : {}) });
    return res.json({ success: true });
  } catch (error) {
    console.error("Record search selection error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/user/search/history
export const getMySearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page ?? "1", 10) || 1;
    const limit = parseInt(req.query.limit ?? "10", 10) || 10;
    const data = await getSearchHistory(userId, page, limit);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error("Get search history error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// DELETE /api/user/search/history
export const clearMySearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    await clearSearchHistory(userId);
    return res.json({ success: true });
  } catch (error) {
    console.error("Clear search history error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// DELETE /api/user/search/history/:type/:id
export const deleteSearchHistoryItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, id } = req.params;
    if (!type || !id) {
      return res.status(400).json({ success: false, message: "Thiếu tham số" });
    }
    await removeSearchItem(userId, { type, userId: parseInt(id, 10) || id });
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete search history item error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};



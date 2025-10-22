import prisma from "../../utils/prisma.js";
import { addSearchSelection, getSearchHistory, clearSearchHistory, removeSearchItem } from "../../services/redis/searchHistoryService.js";

// GET /api/user/search?q=...
export const searchUsers = async (req, res) => {
  try {
    const query = (req.query.q || req.query.query || "").trim();
    if (!query) {
      return res.json({ success: true, users: [] });
    }

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
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, users });
  } catch (error) {
    console.error("Search users error:", error);
    return res.status(500).json({ success: false, message: "Tìm kiếm thất bại" });
  }
};

// POST /api/user/search/selection
export const recordSearchSelection = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

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
// GET /api/user/:username/profile
export const getPublicProfile = async (req, res) => {
  try {
    const userId = req.resolvedUserId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        privacySettings: true
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Get public profile error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET /api/user/search/history
export const getMySearchHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
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



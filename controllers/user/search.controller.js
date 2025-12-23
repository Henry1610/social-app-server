import { searchUsers as searchUsersService } from "../../services/searchService.js";
import { addSearchSelection, getSearchHistory, clearSearchHistory, removeSearchItem } from "../../services/redis/searchHistoryService.js";

// GET /api/user/search?q=...
export const searchUsers = async (req, res) => {
  try {
    const query = (req.query.q || req.query.query || "").trim();
    const currentUserId = req.user.id;

    const users = await searchUsersService(query, currentUserId);

    return res.json({ success: true, users });
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



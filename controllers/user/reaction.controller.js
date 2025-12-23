import {
  createOrUpdateReactionService,
  getReactionsService,
  getMyReactionService,
  getReactionStatsService
} from "../../services/reactionService.js";

/**
 * POST /api/user/reactions
 * Tạo, cập nhật hoặc xóa reaction (toggle nếu cùng loại)
 */
export const createOrUpdateReaction = async (req, res) => {
  try {
    const { targetId, targetType, type } = req.body;
    const userId = req.user.id;

    const result = await createOrUpdateReactionService({
      userId,
      targetId,
      targetType,
      type
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.status(200).json({
      success: true,
      reaction: result.reaction
    });
  } catch (error) {
    console.error("Error in createOrUpdateReaction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
/**
 * GET /api/user/reactions?targetId=123&targetType=POST
 * Lấy danh sách reactions của một target
 */
export const getReactions = async (req, res) => {
  try {
    const { targetId, targetType } = req.query;

    const result = await getReactionsService({
      targetId,
      targetType
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      reactions: result.reactions
    });
  } catch (error) {
    console.error("Error in getReactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
/**
 * GET /api/user/reactions/me?targetId=123&targetType=POST
 * Lấy reaction của current user cho một target
 */
export const getMyReaction = async (req, res) => {
  try {
    const { targetId, targetType } = req.query;
    const userId = req.user.id;

    const result = await getMyReactionService({
      userId,
      targetId,
      targetType
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.status(200).json({
      success: true,
      reaction: result.reaction
    });
  } catch (error) {
    console.error("Error in getMyReaction:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * GET /api/user/reactions/stats?targetId=123&targetType=COMMENT
 * Lấy thống kê số lượng reactions theo từng type
 */
export const getReactionStats = async (req, res) => {
  try {
    const { targetId, targetType } = req.query;

    const result = await getReactionStatsService({
      targetId,
      targetType
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.status(200).json({
      success: true,
      stats: result.stats,
      total: result.total
    });
  } catch (error) {
    console.error("Error in getReactionStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
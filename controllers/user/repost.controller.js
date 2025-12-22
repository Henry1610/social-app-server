import { 
  getUserReposts as getUserRepostsService,
  createRepostService,
  undoRepostService,
  markRepostAsViewedService
} from "../../services/repostService.js";
/**
 * GET /api/user/:username/reposts
 * Lấy danh sách reposts của một user
 * Cho phép xem reposts của người khác (với kiểm tra privacy settings)
 */
export const getUserReposts = async (req, res) => {
  const targetUserId = Number(req.resolvedUserId);
  const currentUserId = Number(req.user.id);

  try {
    const reposts = await getUserRepostsService(targetUserId, currentUserId);
    return res.json({ success: true, reposts });
  } catch (error) {
    // Nếu error có statusCode thì dùng statusCode và message từ error
    if (error.statusCode) {
      return res.status(error.statusCode).json({ 
        success: false, 
        message: error.message 
      });
    }
    // Nếu là lỗi khác
    console.error('Error getUserReposts:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
};

// POST /api/user/reposts/:postId
export const repostPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content = '' } = req.body;
    const userId = req.user.id;

    const result = await createRepostService(userId, postId, content);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error reposting:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi repost!'
    });
  }
};

// DELETE /api/user/reposts/:postId
export const undoRepost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const result = await undoRepostService(userId, postId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error undoing repost:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi hủy repost!'
    });
  }
};

// POST /api/user/reposts/:repostId/view - Đánh dấu repost đã xem
export const markRepostAsViewed = async (req, res) => {
  try {
    const { repostId } = req.params;
    const userId = req.user.id;

    const result = await markRepostAsViewedService(repostId, userId);

    if (!result.success) {
      const statusCode = result.message.includes('không hợp lệ') ? 400 : 404;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error marking repost as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu repost đã xem'
    });
  }
};


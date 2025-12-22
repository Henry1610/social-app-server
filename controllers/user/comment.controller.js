import {
  getCommentsByPostService,
  commentPostService,
  deleteCommentService,
  getCommentsByRepostService,
  commentRepostService,
  replyCommentService,
  getRepliesByCommentService
} from "../../services/commentService.js";

/**
 * GET /api/user/comments/posts/:id
 * Lấy danh sách comments của một post với pagination (để support infinite scroll)
 * req.params.id: postId
 * req.query: page, limit, sortBy
 */
export const getCommentsByPost = async (req, res) => {
  try {
    const { id } = req.params;
    const postId = Number(id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'desc';

    const result = await getCommentsByPostService(postId, { page, limit, sortBy });

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bình luận!'
    });
  }
};

//POST /api/user/comments/posts/:id
export const commentPost = async (req, res) => {
  try {
    const { id } = req.params;
    const postId = Number(id);
    const { content } = req.body;
    const userId = req.user.id;

    const result = await commentPostService(postId, userId, content);

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error commenting on post:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thêm bình luận!'
    });
  }
};
/**
 * DELETE /api/user/comments/:id
 * Xóa một comment (soft delete - chỉ chủ comment mới được xóa)
 * req.params.id: commentId
 */
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const commentId = Number(id);
    const userId = req.user.id;

    // Xóa comment bằng service
    const result = await deleteCommentService(commentId, userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa bình luận!'
    });
  }
};

/**
 * GET /api/user/comments/reposts/:id
 * Lấy danh sách comments của một repost với pagination (để support infinite scroll)
 * req.params.id: repostId
 * req.query: page, limit, sortBy
 */
export const getCommentsByRepost = async (req, res) => {
  try {
    const { id } = req.params;
    const repostId = Number(id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'desc';

    const result = await getCommentsByRepostService(repostId, { page, limit, sortBy });

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting repost comments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bình luận!'
    });
  }
};

/**
 * POST /api/user/comments/reposts/:id
 * Tạo comment mới cho một repost
 * Lưu ý: Quyền comment được kiểm tra dựa trên post gốc (không phải repost)
 * req.params.id: repostId
 * req.body.content: nội dung comment
 */
export const commentRepost = async (req, res) => {
  try {
    const { id } = req.params;
    const repostId = Number(id);
    const { content } = req.body;
    const userId = req.user.id;

    const result = await commentRepostService(repostId, userId, content);

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error commenting on repost:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi thêm bình luận!'
    });
  }
};

/**
 * POST /api/user/comments/:id/reply
 * req.params.id: parentCommentId
 * req.body.content: nội dung reply
 */
export const replyComment = async (req, res) => {
  try {
    const { id } = req.params;
    const parentCommentId = Number(id);
    const { content } = req.body;
    const userId = req.user.id;

    const result = await replyCommentService(parentCommentId, userId, content);

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error replying to comment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi server khi thêm phản hồi!'
    });
  }
};

/**
 * GET /api/user/comments/:id/replies
 * Lấy danh sách replies của một comment với pagination
 * req.params.id: parentCommentId
 * req.query: page, limit, sortBy
 */
export const getRepliesByComment = async (req, res) => {
  try {
    const { id } = req.params;
    const parentCommentId = Number(id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'desc';

    const result = await getRepliesByCommentService(parentCommentId, { page, limit, sortBy });

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting replies:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy phản hồi!'
    });
  }
};
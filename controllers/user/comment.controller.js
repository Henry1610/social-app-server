import prisma from "../../utils/prisma.js";
import { postEvents } from "../../socket/events/postEvents.js";
import { checkCommentPermission, fetchComments, createComment, createReplyComment, fetchReplies } from "../../services/commentService.js";

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
    const sortBy = req.query.sortBy || 'desc'; // 'desc' (mới nhất) hoặc 'asc' (cũ nhất)

    // Kiểm tra post có tồn tại không
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc đã bị xóa!'
      });
    }

    // Lấy comments gốc (chỉ lấy comments không có parentId)
    const result = await fetchComments({
      where: {
        postId: postId,
        parentId: null, // Chỉ lấy comments gốc
        deletedAt: null
      },
      page,
      limit,
      sortBy,
      includeMentions: false
    });

    res.json({
      success: true,
      comments: result.comments,
      pagination: result.pagination
    });

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

    // Kiểm tra bài viết có tồn tại không
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null
      }
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc đã bị xóa!'
      });
    }

    // Kiểm tra quyền comment dựa trên cài đặt quyền riêng tư của bài viết
    const permissionCheck = await checkCommentPermission(userId, post);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message
      });
    }

    // Tạo bình luận mới bằng service
    const newComment = await createComment({
      type: 'post',
      entityId: postId,
      userId,
      content
    });

    // Gửi thông báo cho chủ post (nếu không phải chính họ comment)
    if (post.userId !== userId) {
      postEvents.emit("comment_created", {
        actor: {
          id: userId,
          username: newComment.user.username,
          fullName: newComment.user.fullName,
          avatarUrl: newComment.user.avatarUrl
        },
        postId: postId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Bình luận đã được thêm!',
      comment: newComment
    });
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

    // Kiểm tra bình luận có tồn tại và thuộc về user
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        userId: userId,
        deletedAt: null
      },
      select: { id: true, postId: true, repostId: true }
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Bình luận không tồn tại hoặc bạn không có quyền xóa!'
      });
    }

    // Xóa bình luận (soft delete - chỉ đánh dấu deletedAt, không xóa thật)
    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() }
    });

    res.json({
      success: true,
      message: 'Bình luận đã được xóa!'
    });
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

    // Parse query parameters với giá trị mặc định
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'desc';

    // Kiểm tra repost có tồn tại không và post gốc còn tồn tại
    const repost = await prisma.repost.findFirst({
      where: {
        id: repostId,
        deletedAt: null,
        // Đảm bảo post gốc còn tồn tại và không bị xóa
        post: {
          deletedAt: null
        }
      },
      select: { id: true }
    });

    if (!repost) {
      return res.status(404).json({
        success: false,
        message: 'Repost không tồn tại, đã bị xóa hoặc bài viết gốc đã bị xóa!'
      });
    }

    // Lấy comments gốc (chỉ lấy comments không có parentId)
    const result = await fetchComments({
      where: {
        repostId: repostId,
        parentId: null, // Chỉ lấy comments gốc
        deletedAt: null
      },
      page,
      limit,
      sortBy,
      includeMentions: true
    });

    res.json({
      success: true,
      comments: result.comments,
      pagination: result.pagination
    });
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

    // Lấy repost và post gốc (để kiểm tra quyền comment)
    // Chỉ lấy repost nếu post gốc còn tồn tại và không bị xóa
    const repost = await prisma.repost.findFirst({
      where: {
        id: repostId,
        deletedAt: null,
        // Đảm bảo post gốc còn tồn tại và không bị xóa
        post: {
          deletedAt: null
        }
      },
      include: {
        post: true // Lấy post gốc để check quyền comment
      }
    });

    if (!repost) {
      return res.status(404).json({
        success: false,
        message: 'Repost không tồn tại, đã bị xóa hoặc bài viết gốc đã bị xóa!'
      });
    }

    // Kiểm tra quyền comment dựa trên cài đặt của post gốc
    const permissionCheck = await checkCommentPermission(userId, repost.post);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message
      });
    }

    // Tạo bình luận mới cho repost bằng service
    const newComment = await createComment({
      type: 'repost',
      entityId: repostId,
      userId,
      content
    });

    // Gửi thông báo cho chủ post gốc (nếu không phải chính họ comment)
    // Lưu ý: notification gửi cho chủ post gốc, không phải người repost
    if (repost.post.userId !== userId) {
      postEvents.emit("comment_created", {
        actor: {
          id: userId,
          username: newComment.user.username,
          fullName: newComment.user.fullName,
          avatarUrl: newComment.user.avatarUrl
        },
        postId: repost.post.id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Bình luận đã được thêm!',
      comment: newComment
    });
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

    // Lấy comment cha để kiểm tra và lấy thông tin post/repost
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentCommentId },
      include: {
        post: {
          select: { id: true, userId: true, whoCanComment: true, deletedAt: true }
        },
        repost: {
          include: {
            post: {
              select: { id: true, userId: true, whoCanComment: true, deletedAt: true }
            }
          }
        }
      }
    });

    if (!parentComment || parentComment.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Comment không tồn tại hoặc đã bị xóa!'
      });
    }

    // Kiểm tra quyền comment dựa trên post (nếu là comment của post) hoặc post gốc (nếu là comment của repost)
    const post = parentComment.post || (parentComment.repost && parentComment.repost.post);
    if (!post || post.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc đã bị xóa!'
      });
    }

    const permissionCheck = await checkCommentPermission(userId, post);
    if (!permissionCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: permissionCheck.message
      });
    }

    // Tạo reply comment
    const newReply = await createReplyComment({
      parentCommentId,
      userId,
      content
    });

    // Gửi thông báo cho chủ comment (nếu không phải chính họ reply)
    if (parentComment.userId !== userId) {
      postEvents.emit("reply_created", {
        actor: {
          id: userId,
          username: newReply.user.username,
          fullName: newReply.user.fullName,
          avatarUrl: newReply.user.avatarUrl
        },
        commentId: parentCommentId,
        postId: post.id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Phản hồi đã được thêm!',
      reply: newReply
    });
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

    // Kiểm tra comment cha có tồn tại không
    const parentComment = await prisma.comment.findFirst({
      where: {
        id: parentCommentId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: 'Comment không tồn tại hoặc đã bị xóa!'
      });
    }

    // Lấy replies bằng service
    const result = await fetchReplies({
      parentId: parentCommentId,
      page,
      limit,
      sortBy
    });

    res.json({
      success: true,
      replies: result.replies,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error getting replies:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy phản hồi!'
    });
  }
};
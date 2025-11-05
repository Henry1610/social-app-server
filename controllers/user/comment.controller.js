import prisma from "../../utils/prisma.js";
import { postEvents } from "../../socket/events/postEvents.js";

/**
 * Helper function: Kiểm tra quyền comment dựa trên whoCanComment setting
 * userId: ID của user đang cố comment
 * post: Post object có userId và whoCanComment
 * Trả về: {allowed: boolean, message?: string}
 */
const checkCommentPermission = async (userId, post) => {
  const whoCanComment = post.whoCanComment || 'everyone';
  
  switch (whoCanComment) {
    case "everyone":
      return { allowed: true };
      
    case "followers":
      const isFollower = await prisma.follow.findFirst({
        where: {
          followerId: userId,
          followingId: post.userId,
        },
      });
      if (!isFollower) {
        return { allowed: false, message: "Chỉ follower mới được comment" };
      }
      return { allowed: true };
      
    case "nobody":
      if (post.userId !== userId) {
        return { allowed: false, message: "Chỉ chủ post mới được comment" };
      }
      return { allowed: true };
      
    default:
      return { allowed: false, message: "Cấu hình quyền comment không hợp lệ" };
  }
};

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
    const skip = (page - 1) * limit;

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

    // Lấy comments và tổng số comments song song (parallel) để tối ưu performance
    const [comments, totalComments] = await Promise.all([
      // Lấy danh sách comments với pagination
      prisma.comment.findMany({
        where: {
          postId: postId,
          deletedAt: null
        },
        include: {
          user: {
            select: { id: true, username: true, fullName: true, avatarUrl: true }
          },
          _count: {
            select: {
              replies: true   // Số lượng reply của comment này
            }
          }
        },
        orderBy: { createdAt: sortBy },
        skip: skip,
        take: limit
      }),
      // Đếm tổng số comments (để tính pagination metadata)
      prisma.comment.count({
        where: {
          postId: postId,
          deletedAt: null
        }
      })
    ]);

    // Tính toán thông tin pagination để frontend biết còn comments không
    const totalPages = Math.ceil(totalComments / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      comments,
      pagination: {
        currentPage: page,
        limit: limit,
        totalComments,
        totalPages,
        hasNextPage,  // Frontend dùng để biết có thể load thêm không
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bình luận!'
    });
  }
};
/**
 * POST /api/user/comments/posts/:id
 * Tạo comment mới cho một post
 * req.params.id: postId
 * req.body.content: nội dung comment
 */
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

    // Tạo bình luận mới
    const newComment = await prisma.comment.create({
      data: {
        content,
        postId: postId,
        userId: userId
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
        _count: {
          select: {
            replies: true
          }
        }
      }
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
    const skip = (page - 1) * limit;

    // Kiểm tra repost có tồn tại không
    const repost = await prisma.repost.findFirst({
      where: {
        id: repostId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!repost) {
      return res.status(404).json({
        success: false,
        message: 'Repost không tồn tại hoặc đã bị xóa!'
      });
    }

    // Lấy comments và tổng số comments song song (parallel) để tối ưu performance
    const [comments, totalComments] = await Promise.all([
      // Lấy danh sách comments với pagination
      prisma.comment.findMany({
        where: {
          repostId: repostId,
          deletedAt: null
        },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
        _count: {
          select: {
            replies: true,
            mentions: true
          }
        }
        },
        orderBy: { createdAt: sortBy },
        skip: skip,
        take: limit
      }),
      // Đếm tổng số comments (để tính pagination metadata)
      prisma.comment.count({
        where: {
          repostId: repostId,
          deletedAt: null
        }
      })
    ]);

    // Tính toán thông tin pagination để frontend biết còn comments không
    const totalPages = Math.ceil(totalComments / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      comments,
      pagination: {
        currentPage: page,
        limit: limit,
        totalComments,
        totalPages,
        hasNextPage,  // Frontend dùng để biết có thể load thêm không
        hasPrevPage
      }
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
    const repost = await prisma.repost.findFirst({
      where: {
        id: repostId,
        deletedAt: null
      },
      include: {
        post: true // Lấy post gốc để check quyền comment
      }
    });
    
    if (!repost) {
      return res.status(404).json({
        success: false,
        message: 'Repost không tồn tại hoặc đã bị xóa!'
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

    // Tạo bình luận mới cho repost
    const newComment = await prisma.comment.create({
      data: {
        content,
        repostId: repostId,
        userId: userId
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
        _count: {
          select: {
            replies: true
          }
        }
      }
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
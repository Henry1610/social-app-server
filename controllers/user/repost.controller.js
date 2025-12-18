import prisma from "../../utils/prisma.js";
import { getUserReposts as getUserRepostsService } from "../../services/repostService.js";
import { postEvents } from "../../socket/events/postEvents.js";
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

    // Check if original post exists
    const originalPost = await prisma.post.findUnique({
      where: { id: Number(postId) },
    });

    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết gốc không tồn tại!'
      });
    }

    // Upsert repost (tạo mới hoặc phục hồi nếu đã xóa mềm)
    const repost = await prisma.repost.upsert({
      where: {
        userId_postId: {  // tên composite key tự sinh từ @@id([userId, postId])
          userId,
          postId: Number(postId)
        }
      },
      update: { deletedAt: null, content, createdAt: new Date() }, // phục hồi nếu trước đó đã xóa mềm
      create: {
        userId,
        postId: Number(postId),
        content,
        createdAt: new Date(),
      },
    });

    // Lấy thông tin user để emit event (vì repost.upsert không include user relation)
    // Notification sẽ được tạo tự động bởi postEvents handler
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, fullName: true, avatarUrl: true }
    });

    if (user && originalPost.userId !== userId) {
      postEvents.emit("repost_created", {
        actor: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl
        },
        postId: Number(postId),
        postUserId: originalPost.userId
      });
    }
    res.json({
      success: true,
      message: 'Repost thành công!',
      repost
    });
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

    const result = await prisma.$transaction(async (prisma) => {
      // Tìm repost chưa xóa
      const repost = await prisma.repost.findFirst({
        where: { userId, postId: Number(postId), deletedAt: null },
      });

      if (!repost) return null;

      // Xóa mềm
      await prisma.repost.update({
        where: { id: repost.id },
        data: { deletedAt: new Date() },
      });

      // Đếm repost còn lại
      const repostCount = await prisma.repost.count({
        where: { postId: Number(postId), deletedAt: null },
      });

      return repostCount;
    });
    if (result === null) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa repost bài viết này!",
      });
    }
    res.json({
      success: true,
      message: 'Hủy repost thành công!',
      repostCount: result,
    });
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

    // Validate repostId
    const parsedRepostId = parseInt(repostId);
    if (!repostId || isNaN(parsedRepostId)) {
      return res.status(400).json({
        success: false,
        message: 'ID repost không hợp lệ'
      });
    }

    // Kiểm tra repost có tồn tại không
    const repost = await prisma.repost.findUnique({
      where: { id: parsedRepostId },
      select: { id: true, deletedAt: true }
    });

    if (!repost || repost.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Repost không tồn tại'
      });
    }

    // Upsert repost view (nếu đã xem rồi thì chỉ update viewedAt)
    await prisma.postView.upsert({
      where: {
        repostId_userId: {
          repostId: parsedRepostId,
          userId: userId
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        repostId: parsedRepostId,
        userId: userId,
        viewedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Đã đánh dấu repost đã xem'
    });
  } catch (error) {
    console.error('Error marking repost as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu repost đã xem'
    });
  }
};


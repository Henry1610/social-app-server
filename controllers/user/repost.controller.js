import prisma from "../../utils/prisma.js";

// GET /api/user/reposts
export const getAllMyReposts = async (req, res) => {
  const userId = req.user.id; // id người dùng muốn lấy repost

  try {
    const reposts = await prisma.repost.findMany({
      where: { userId: userId }, // chỉ lấy repost của user này
      orderBy: { createdAt: 'desc' },
      include: {
        user: { // người repost
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true
          }
        },
        post: { // bài viết gốc
          include: {
            user: { // người đăng bài gốc
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true
              }
            },
            media: true,
            hashtags: {
              include: { hashtag: true }
            },
            mentions: {
              include: {
                user: { select: { id: true, username: true, fullName: true } }
              }
            },
            privacySettings: true,
            _count: { select: { reactions: true, comments: true, reposts: true } }
          }
        }
      }
    });

    res.json({ success: true, reposts });
  } catch (error) {
    console.error('Error getAllRePosts:', error);
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
};

// GET /api/user/reposts/:id
export const repostPost = async (req, res) => {
  try {
    const { id: postId } = req.params;
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
    

    // Tạo notification cho tác giả bài gốc
    await prisma.notification.create({
      data: {
        userId: originalPost.userId,
        actorId: userId,
        type: 'repost',
        targetType: 'post',
        targetId: Number(postId),
        isRead: false,
        createdAt: new Date(),
      },
    });

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

// DELETE /api/user/reposts/:id
export const undoRepost = async (req, res) => {
  try {
    const { id: postId } = req.params;
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


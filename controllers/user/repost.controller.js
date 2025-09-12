import prisma from "../../utils/prisma.js";

// GET /api/user/reposts
export const getMyAllReposts = async (req, res) => {
    const userId = req.user.id; // id người dùng muốn lấy repost
  
    try {
      const reposts = await prisma.repost.findMany({
        where: { user_id: userId }, // chỉ lấy repost của user này
        orderBy: { created_at: 'desc' },
        include: {
          user: { // người repost
            select: {
              id: true,
              username: true,
              full_name: true,
              avatar_url: true
            }
          },
          post: { // bài viết gốc
            include: {
              user: { // người đăng bài gốc
                select: {
                  id: true,
                  username: true,
                  full_name: true,
                  avatar_url: true
                }
              },
              post_media: true,
              post_hashtags: {
                include: { hashtag: true }
              },
              mentions: {
                include: {
                  user: { select: { id: true, username: true, full_name: true } }
                }
              },
              post_privacy_settings: true,
              _count: { select: { reactions: true, comments: true, repost: true } }
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
      const originalPost = await prisma.posts.findUnique({
        where: { id: Number(postId) },
      });
  
      if (!originalPost) {
        return res.status(404).json({ 
          success: false, 
          message: 'Bài viết gốc không tồn tại!' 
        });
      }
  
      // Check if user already reposted this post
      const existingRepost = await prisma.repost.findFirst({
        where: {
          user_id: userId,
          post_id: Number(postId),
        },
      });
  
      if (existingRepost) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bạn đã repost bài viết này rồi!' 
        });
      }
  
      // Create repost record
      const repost = await prisma.repost.create({
        data: {
          user_id: userId,
          post_id: Number(postId),
          content,
          created_at: new Date(),
        },
      });
  
      // Create notification for original post author
      await prisma.notifications.create({
        data: {
          user_id: originalPost.user_id,
          actor_id: userId,
          type: 'repost',
          target_type: 'post',
          target_id: Number(postId),
          is_read: false,
          created_at: new Date(),
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

    // Tìm repost của user
    const repost = await prisma.repost.findFirst({
      where: {
        user_id: userId,
        post_id: Number(postId),
        deleted_at: null, // chỉ tìm repost chưa xóa
      },
    });

    if (!repost) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bạn chưa repost bài viết này!' 
      });
    }

    // Xóa mềm repost
    await prisma.repost.update({
      where: { id: repost.id },
      data: { deleted_at: new Date() },
    });

    // Cập nhật lại count repost trong post
    const repostCount = await prisma.repost.count({
      where: { post_id: Number(postId), deleted_at: null },
    });

    await prisma.posts.update({
      where: { id: Number(postId) },
      data: { 
        _count: { 
          ...repostCount 
        }
      },
    });

    res.json({ 
      success: true, 
      message: 'Hủy repost thành công!' 
    });
  } catch (error) {
    console.error('Error undoing repost:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi hủy repost!' 
    });
  }
};

  
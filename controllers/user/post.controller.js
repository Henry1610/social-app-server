import { 
  createPostService, 
  updatePostService,
  getPostByIdService,
  deletePostService,
  savePostService,
  unsavePostService,
  getSavedPostsService,
  getUserPostsPreviewService,
  markPostAsViewedService,
  getFeedPostsService
} from "../../services/postService.js";

/*---------------------------------POST---------------------------------*/
// POST /api/user/posts
export const createPost = async (req, res) => {
  try {
    const {
      content,
      mediaUrls = [],
      privacySettings = {}
    } = req.body;
    const userId = req.user.id;

    if ((!content || content.trim() === '') && mediaUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bài viết phải có nội dung hoặc media!'
      });
    }

    // Tạo post bằng service
    const completePost = await createPostService({
      userId,
      content,
      mediaUrls,
      privacySettings
    });

    res.json({
      success: true,
      message: 'Tạo bài viết thành công!',
      post: completePost
    });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo bài viết!'
    });
  }
};

// GET /api/user/posts/:postId
export const getMyPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.user.id;

    // Validate postId
    const parsedPostId = Number(postId);
    if (!postId || isNaN(parsedPostId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ!'
      });
    }

    const result = await getPostByIdService({
      postId: parsedPostId,
      currentUserId
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      post: result.post
    });
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy bài viết!'
    });
  }
};

// PUT /api/user/posts/:postId
export const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const {
      content,
      mediaUrls,
      privacySettings = {}
    } = req.body;
    const userId = req.user.id;

    // Cập nhật post bằng service
    const completePost = await updatePostService({
      postId: Number(postId),
      userId,
      content,
      mediaUrls,
      privacySettings
    });

    res.json({
      success: true,
      message: 'Cập nhật bài viết thành công!',
      post: completePost
    });
  } catch (error) {
    console.error('Error updating post:', error);
    
    // Xử lý error từ service
    if (error.message === 'Bài viết không tồn tại hoặc không thuộc về bạn!') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật bài viết!'
    });
  }
};

// DELETE /api/user/posts/:postId
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const result = await deletePostService({
      postId: Number(postId),
      userId
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      message: result.message,
      post: result.post
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa bài viết!' });
  }
};

/*---------------------------------SAVE POST---------------------------------*/

// POST /api/user/posts/:postId/save
export const savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const result = await savePostService({
      postId: Number(postId),
      userId
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      message: result.message,
      saved: result.saved
    });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu bài viết!' });
  }
};

// DELETE /api/user/posts/:postId/save
export const unsavePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const result = await unsavePostService({
      postId: Number(postId),
      userId
    });

    res.json({
      success: true,
      message: result.message,
      postId: Number(postId)
    });
  } catch (error) {
    console.error('Error unsaving post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi bỏ lưu bài viết!' });
  }
};

/**
 * GET /api/user/profile/:username/saved-posts
 * Lấy danh sách bài viết đã lưu của một user
 * Chỉ cho phép xem saved posts của chính mình
 */
export const getUserSavedPostsReview = async (req, res) => {
  try {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Chỉ cho phép xem saved posts của chính mình
    if (targetUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể xem bài viết đã lưu của chính mình!'
      });
    }

    // Lấy saved posts bằng service
    const { items: itemsWithReactions, total } = await getSavedPostsService({
      userId: targetUserId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      items: itemsWithReactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Error fetching saved posts:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy bài viết đã lưu!' });
  }
};

export const getUserPostsPreview = async (req, res) => {
  try {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user.id;
    const { page = 1, limit = 12 } = req.query;

    const result = await getUserPostsPreviewService({
      targetUserId,
      currentUserId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      posts: result.posts,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error getUserPostsPreview:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy bài viết!' });
  }
};

// POST /api/user/posts/:postId/view - Đánh dấu post đã xem
export const markPostAsViewed = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Validate postId
    const parsedPostId = parseInt(postId);
    if (!postId || isNaN(parsedPostId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bài viết không hợp lệ'
      });
    }

    const result = await markPostAsViewedService({
      postId: parsedPostId,
      userId
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error marking post as viewed:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu bài viết đã xem'
    });
  }
};

// GET /api/user/posts/feed - Lấy feed posts (từ users đang follow + chính mình)
export const getFeedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Lấy feed posts bằng service
    const result = await getFeedPostsService({
      userId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting feed posts:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy feed!'
    });
  }
};

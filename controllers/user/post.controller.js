import prisma from "../../utils/prisma.js";

/*---------------------------------POST---------------------------------*/ 
// POST /api/user/posts
export const createPost = async (req, res) => {
  try {
    const { 
      content, 
      mediaUrls = [],
      hashtags = [],
      mentions = [],
      privacySettings = {}
    } = req.body;

    const userId = req.user.id;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        message: 'content là bắt buộc!' 
      });
    }

    // Start transaction to create post with related data
    const result = await prisma.$transaction(async (tx) => {
      // Create the post
      const post = await tx.posts.create({
        data: {
          user_id: userId,
          content,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Create post privacy settings
      await tx.post_privacy_settings.create({
        data: {
          post_id: post.id,
          who_can_see: privacySettings.who_can_see || 'public',
          who_can_comment: privacySettings.who_can_comment || 'everyone',
        },
      });

      // Handle media attachments
      if (mediaUrls && mediaUrls.length > 0) {
        const mediaData = mediaUrls.map(media => ({
          post_id: post.id,
          media_url: media.url,
          media_type: media.type || 'image',
          created_at: new Date(),
        }));
        await tx.post_media.createMany({
          data: mediaData,
        });
      }

      // Handle hashtags
      if (hashtags && hashtags.length > 0) {
        for (const hashtagName of hashtags) {
          // Create hashtag if it doesn't exist, or get existing one
          const hashtag = await tx.hashtags.upsert({
            where: { name: hashtagName },
            update: {},
            create: { name: hashtagName },
          });

          // Link hashtag to post
          await tx.post_hashtags.create({
            data: {
              post_id: post.id,
              hashtag_id: hashtag.id,
            },
          });
        }
      }

      // Handle mentions
      if (mentions && mentions.length > 0) {
        const mentionData = mentions.map(mentionedUserId => ({
          user_id: mentionedUserId,
          post_id: post.id,
          created_at: new Date(),
        }));
        await tx.mentions.createMany({
          data: mentionData,
        });

        // Create notifications for mentioned users
        const notificationData = mentions.map(mentionedUserId => ({
          user_id: mentionedUserId,
          actor_id: userId, // The user who created the post
          type: 'mention',
          target_type: 'post',
          target_id: post.id,
          is_read: false,
          created_at: new Date(),
        }));
        await tx.notifications.createMany({
          data: notificationData,
        });
      }

      return post;
    });

    // Fetch the complete post with all related data
    const completePost = await prisma.posts.findUnique({
      where: { id: result.id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
          },
        },
        post_media: true,
        post_hashtags: {
          include: {
            hashtag: true,
          },
        },
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
              },
            },
          },
        },
        post_privacy_settings: true,
        _count: {
          select: {
            reactions: true,
            comments: true,
            repost: true,
          },
        },
      },
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

// GET /api/user/posts
export const getAllMyPosts = async (req, res) => {
  
  try {
    const userId = req.user?.id; 
    const posts = await prisma.posts.findMany({
      where: {
        user_id: userId,
        deleted_at: null, // chỉ lấy các bài chưa xoá
      },
      include: {
        user: true, // thông tin người đăng
        post_media: true,
        post_hashtags: {
          include: { hashtag: true }
        },
        mentions: {
          include: { user: { select: { id: true, username: true, full_name: true } } }
        },
        post_privacy_settings: true,
        _count: { select: { reactions: true, comments: true, repost: true } }
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ success: true, posts });
  } catch (error) {
    console.error('Error getAllPosts:', error);
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
};

// GET /api/user/posts/:id
export const getMyPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; 
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để thực hiện thao tác này!'
      });
    }
    const post = await prisma.posts.findFirst({
      where: { 
        id: Number(id),
        user_id: userId,
        deleted_at: null // Chỉ lấy bài viết chưa bị xóa
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
          },
        },
        post_media: true,
        post_hashtags: {
          include: {
            hashtag: true,
          },
        },
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
              },
            },
          },
        },
        post_privacy_settings: true,
        _count: {
          select: {
            reactions: true,
            comments: true,
            repost: true, // Số lượng repost
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bài viết không tồn tại hoặc đã bị xóa!' 
      });
    }

    // Lấy thông tin repost nếu có
    const reposts = await prisma.repost.findMany({
      where: { post_id: Number(id) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10, // Chỉ lấy 10 repost gần nhất
    });

    res.json({ 
      success: true, 
      post: {
        ...post,
        reposts
      }
    });
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi lấy bài viết!' 
    });
  }
};

// PUT /api/user/posts/:id
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      content, 
      mediaUrls = [],
      hashtags = [],
      mentions = [],
      privacySettings = {}
    } = req.body;
    const userId = req.user.id;

    // Check if post exists and belongs to user
    const existingPost = await prisma.posts.findFirst({
      where: { 
        id: Number(id),
        user_id: userId,
        deleted_at: null
      },
    });

    if (!existingPost) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bài viết không tồn tại hoặc không thuộc về bạn!' 
      });
    }

    // Start transaction to update post with related data
    const result = await prisma.$transaction(async (tx) => {
      // Update the post
      const post = await tx.posts.update({
        where: { id: Number(id) },
        data: { 
          content, 
          updated_at: new Date() 
        },
      });

      // Update post privacy settings
      if (privacySettings && Object.keys(privacySettings).length > 0) {
        await tx.post_privacy_settings.upsert({
          where: { post_id: Number(id) },
          update: {
            who_can_see: privacySettings.who_can_see,
            who_can_comment: privacySettings.who_can_comment,
          },
          create: {
            post_id: Number(id),
            who_can_see: privacySettings.who_can_see || 'public',
            who_can_comment: privacySettings.who_can_comment || 'everyone',
          },
        });
      }

      // Handle media attachments - delete old and create new
      if (mediaUrls !== undefined) {
        // Delete existing media
        await tx.post_media.deleteMany({
          where: { post_id: Number(id) },
        });

        // Create new media if provided
        if (mediaUrls && mediaUrls.length > 0) {
          const mediaData = mediaUrls.map(media => ({
            post_id: Number(id),
            media_url: media.url,
            media_type: media.type || 'image',
            created_at: new Date(),
          }));
          await tx.post_media.createMany({
            data: mediaData,
          });
        }
      }

      // Handle hashtags - delete old and create new
      if (hashtags !== undefined) {
        // Delete existing hashtag links
        await tx.post_hashtags.deleteMany({
          where: { post_id: Number(id) },
        });

        // Create new hashtag links if provided
        if (hashtags && hashtags.length > 0) {
          for (const hashtagName of hashtags) {
            // Create hashtag if it doesn't exist, or get existing one
            const hashtag = await tx.hashtags.upsert({
              where: { name: hashtagName },
              update: {},
              create: { name: hashtagName },
            });

            // Link hashtag to post
            await tx.post_hashtags.create({
              data: {
                post_id: Number(id),
                hashtag_id: hashtag.id,
              },
            });
          }
        }
      }

      // Handle mentions - delete old and create new
      if (mentions !== undefined) {
        // Delete existing mentions
        await tx.mentions.deleteMany({
          where: { post_id: Number(id) },
        });

        // Create new mentions if provided
        if (mentions && mentions.length > 0) {
          const mentionData = mentions.map(mentionUserId => ({
            user_id: mentionUserId,
            post_id: Number(id),
            created_at: new Date(),
          }));
          await tx.mentions.createMany({
            data: mentionData,
          });

          // Create notifications for mentioned users
          const notificationData = mentions.map(mentionUserId => ({
            user_id: mentionUserId,
            actor_id: userId,
            type: 'mention',
            target_type: 'post',
            target_id: Number(id),
            is_read: false,
            created_at: new Date(),
          }));
          await tx.notifications.createMany({
            data: notificationData,
          });
        }
      }

      return post;
    });

    // Fetch the complete updated post with all related data
    const completePost = await prisma.posts.findUnique({
      where: { id: Number(id) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            avatar_url: true,
          },
        },
        post_media: true,
        post_hashtags: {
          include: {
            hashtag: true,
          },
        },
        mentions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                full_name: true,
              },
            },
          },
        },
        post_privacy_settings: true,
        _count: {
          select: {
            reactions: true,
            comments: true,
            repost: true,
          },
        },
      },
    });

    res.json({ 
      success: true, 
      message: 'Cập nhật bài viết thành công!',
      post: completePost 
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server khi cập nhật bài viết!' 
    });
  }
};

// DELETE /api/user/posts/:id
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if post exists and belongs to user
    const existingPost = await prisma.posts.findFirst({
      where: { 
        id: Number(id),
        user_id: userId,
        deleted_at: null
      },
    });

    if (!existingPost) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bài viết không tồn tại hoặc không thuộc về bạn!' 
      });
    }

    const post = await prisma.posts.update({
      where: { id: Number(id) },
      data: { deleted_at: new Date() },
    });

    res.json({ success: true, message: 'Post deleted (soft)', post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
};


/*---------------------------------SAVE POST---------------------------------*/ 

// POST /api/user/posts/:id/save
export const savePost = async (req, res) => {
  try {
    const { id } = req.params; // postId
    const userId = req.user.id;

    // Ensure post exists and not soft-deleted
    const post = await prisma.posts.findFirst({
      where: { id: Number(id), deleted_at: null },
      select: { id: true },
    });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại hoặc đã bị xoá!' });
    }

    // Prevent duplicate save
    const exists = await prisma.saved_posts.findUnique({
      where: { user_id_post_id: { user_id: userId, post_id: Number(id) } },
    });
    if (exists) {
      return res.status(200).json({ success: true, message: 'Đã lưu bài viết trước đó.' });
    }

    const saved = await prisma.saved_posts.create({
      data: {
        user_id: userId,
        post_id: Number(id),
        saved_at: new Date(),
      },
    });

    res.json({ success: true, message: 'Đã lưu bài viết!', saved });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu bài viết!' });
  }
};

// DELETE /api/user/posts/:id/save
export const unsavePost = async (req, res) => {
  try {
    const { id } = req.params; // postId
    const userId = req.user.id;

    // Delete if exists
    await prisma.saved_posts.delete({
      where: { user_id_post_id: { user_id: userId, post_id: Number(id) } },
    }).catch(() => {});

    res.json({ success: true, message: 'Đã bỏ lưu bài viết.' });
  } catch (error) {
    console.error('Error unsaving post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi bỏ lưu bài viết!' });
  }
};

// GET /api/user/saved-posts
export const getMySavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.saved_posts.findMany({
        where: { user_id: userId, post: { deleted_at: null } },
        include: {
          post: {
            where: { deleted_at: null },
            include: {
              user: { select: { id: true, username: true, full_name: true, avatar_url: true } },
              post_media: true,
              _count: { select: { reactions: true, comments: true, repost: true } },
            },
          },
        },
        orderBy: { saved_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.saved_posts.count({ where: { user_id: userId, post: { deleted_at: null } } }),
    ]);

    res.json({
      success: true,
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching saved posts:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy bài viết đã lưu!' });
  }
};

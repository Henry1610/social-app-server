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

    if ((!content || content.trim() === '') && mediaUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bài viết phải có nội dung hoặc media!'
      });
    }

    // Transaction
    const post = await prisma.$transaction(async (tx) => {
      // 1. Tạo post
      const createdPost = await tx.post.create({
        data: {
          content: content || null,
          user: { connect: { id: userId } },
        },
      });

      // 2. Tạo privacy settings
      await tx.postPrivacySetting.create({
        data: {
          postId: createdPost.id,
          whoCanSee: privacySettings.whoCanSee || 'public',
          whoCanComment: privacySettings.whoCanComment || 'everyone',
        },
      });

      // 3. Tạo media nếu có
      if (mediaUrls.length > 0) {
        const mediaData = mediaUrls.map(m => ({
          postId: createdPost.id,
          mediaUrl: m.url,
          mediaType: m.type || 'image',
        }));
        await tx.postMedia.createMany({ data: mediaData });
      }

      // 4. Hashtags
      for (const name of hashtags) {
        const hashtag = await tx.hashtag.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        await tx.postHashtag.create({
          data: {
            postId: createdPost.id,
            hashtagId: hashtag.id,
          },
        });
      }

      // 5. Mentions
      if (mentions.length > 0) {
        const usersMentioned = await tx.user.findMany({
          where: { id: { in: mentions } },
          select: { id: true },
        });

        if (usersMentioned.length > 0) {
          const mentionData = usersMentioned.map(u => ({
            userId: u.id,
            postId: createdPost.id,
          }));
          await tx.mention.createMany({ data: mentionData });

          const notificationData = usersMentioned.map(u => ({
            userId: u.id,
            actorId: userId,
            type: 'mention',
            targetType: 'post',
            targetId: createdPost.id,
            isRead: false,
          }));
          await tx.notification.createMany({ data: notificationData });
        }
      }

      return createdPost;
    });

    // Fetch full post với relations
    const completePost = await prisma.post.findUnique({
      where: { id: post.id },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        media: true,
        hashtags: { include: { hashtag: true } },
        mentions: { include: { user: { select: { id: true, username: true, fullName: true } } } },
        privacySettings: true,
        _count: { select: {
           //reactions: true,
            comments: true,
             reposts: true
           } },
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
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      where: { userId: userId, deletedAt: null },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
        media: {
          select: { id: true, mediaUrl: true, mediaType: true }
        },
        hashtags: {
          include: { hashtag: { select: { id: true, name: true } } }
        },
        mentions: {
          include: {
            user: { select: { id: true, username: true, fullName: true } }
          }
        },
        privacySettings: true,
        _count: { select: { reactions: true, comments: true, reposts: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    res.json({ success: true, posts, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Error getAllMyPosts:', error);
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

    const post = await prisma.post.findFirst({
      where: {
        id: Number(id),
        userId: userId,
        deletedAt: null
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
        media: {
          select: { id: true, mediaUrl: true, mediaType: true }
        },
        hashtags: {
          include: { hashtag: { select: { id: true, name: true } } }
        },
        mentions: {
          include: {
            user: { select: { id: true, username: true, fullName: true } }
          }
        },
        privacySettings: true,
        _count: { select: { reactions: true, comments: true, reposts: true } }
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc đã bị xóa!'
      });
    }

    // Lấy thêm 10 repost gần nhất
    const reposts = await prisma.repost.findMany({
      where: { id: Number(id) },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, avatarUrl: true }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({ success: true, post: { ...post, reposts } });
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
      mediaUrls,
      hashtags,
      mentions,
      privacySettings = {}
    } = req.body;
    const userId = req.user.id;

    // Check ownership
    const existingPost = await prisma.post.findFirst({
      where: { id: Number(id), userId: userId, deletedAt: null }
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc không thuộc về bạn!'
      });
    }

    // Transaction
    const updatedPost = await prisma.$transaction(async (tx) => {
      // Update main post
      const post = await tx.post.update({
        where: { id: Number(id) },
        data: {
          content: content ?? existingPost.content,
          updatedAt: new Date()
        },
      });

      // Privacy settings
      if (privacySettings && Object.keys(privacySettings).length > 0) {
        await tx.postPrivacySetting.upsert({
          where: { postId: post.id },
          update: {
            whoCanSee: privacySettings.whoCanSee ?? undefined,
            whoCanComment: privacySettings.whoCanComment ?? undefined,
          },
          create: {
            whoCanSee: privacySettings.whoCanSee || 'public',
            whoCanComment: privacySettings.whoCanComment || 'everyone',
            post: { connect: { id: post.id } }
          },
        });
        
      }

      // Media
      if (mediaUrls !== undefined) {
        await tx.postMedia.deleteMany({ where: { postId: post.id } });
        if (mediaUrls.length > 0) {
          await tx.postMedia.createMany({
            data: mediaUrls.map(m => ({
              postId: post.id,
              mediaUrl: m.mediaUrl,
              mediaType: m.type || 'image',
              createdAt: new Date(),
            })),
          });
        }
      }

      // Hashtags
      if (hashtags !== undefined) {
        await tx.postHashtag.deleteMany({ where: { postId: post.id } });
        for (const hashtagName of hashtags || []) {
          const hashtag = await tx.hashtag.upsert({
            where: { name: hashtagName },
            update: {},
            create: { name: hashtagName },
          });
          await tx.postHashtag.create({
            data: { postId: post.id, hashtagId: hashtag.id },
          });
        }
      }

      // Mentions
      if (mentions !== undefined) {
        await tx.mention.deleteMany({ where: { postId: post.id } });
        if (mentions.length > 0) {
          const mentionData = mentions.map(uid => ({
            userId: uid,
            postId: post.id,
            createdAt: new Date(),
          }));
          await tx.mention.createMany({ data: mentionData });

          //  Chỉ tạo notification cho mentions mới → cần so sánh với mentions cũ
          const notificationData = mentions.map(uid => ({
            userId: uid,
            actorId: userId,
            type: 'mention',
            targetType: 'post',
            targetId: post.id,
            isRead: false,
            createdAt: new Date(),
          }));
          await tx.notification.createMany({ data: notificationData });
        }
      }

      return post;
    });

    // Get full updated post
    const completePost = await prisma.post.findUnique({
      where: { id: Number(id) },
      include: {
        user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        media: true,
        hashtags: { include: { hashtag: true } },
        mentions: { include: { user: { select: { id: true, username: true, fullName: true, avatarUrl: true } } } },
        privacySettings: true,
        _count: { select: { reactions: true, comments: true, reposts: true } },
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

    // Soft delete
    const post = await prisma.post.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date() },
    }).catch(() => null);

    if (!post || post.userId !== userId || post.deletedAt === null) {
      return res.status(404).json({
        success: false,
        message: 'Bài viết không tồn tại hoặc không thuộc về bạn!'
      });
    }

    res.json({
      success: true,
      message: 'Xóa bài viết thành công (soft delete)',
      post
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
};

/*---------------------------------SAVE POST---------------------------------*/

// POST /api/user/posts/:id/save
export const savePost = async (req, res) => {
  try {
    const { id } = req.params;   
    const userId = req.user.id;
    // Check post tồn tại
    const post = await prisma.post.findFirst({
      where: { id: Number(id), deletedAt: null },
      select: { id: true },
    });
    // const post = await prisma.post.findFirst({
    //   where: { id: Number(id), userId: userId, deletedAt: null }
    // });
    if (!post) {
      return res.status(404).json({ success: false, message: 'Bài viết không tồn tại hoặc đã bị xoá!' });
    }

    // Save hoặc bỏ qua nếu đã tồn tại
    const saved = await prisma.savedPost.upsert({
      where: { userId_postId:{userId: userId, postId: Number(id)}  },
      update: {}, // nếu đã có thì không cần update gì
      create: {
        userId: userId,
        postId: Number(id),
        savedAt: new Date(),
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

    await prisma.savedPost.deleteMany({
      where: { userId: userId, postId: Number(id) },
    });

    res.json({ success: true, message: 'Đã bỏ lưu bài viết.', postId: Number(id) });
  } catch (error) {
    console.error('Error unsaving post:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi bỏ lưu bài viết!' });
  }
};

// GET /api/user/posts/saved-posts
export const getMySavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.savedPost.findMany({
        where: { userId: userId, post: { deletedAt: null } },
        include: {
          post: {
            include: {
              user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
              media: true,
              _count: { select: { reactions: true, comments: true, reposts: true } },
            },
          },
        },
        orderBy: { savedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.savedPost.count({
        where: { userId: userId, post: { deletedAt: null } },
      }),
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

import prisma from "../../utils/prisma.js";

// GET /api/user/:username/profile
export const getPublicProfile = async (req, res) => {
  try {
    const userId = req.resolvedUserId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        isOnline: true,
        lastSeen: true,
        privacySettings: true
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Get public profile error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// PUT /api/user/profile/privacy
export const updatePrivacySettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      isPrivate,
      whoCanMessage,
      whoCanTagMe,
      whoCanFindByUsername,
      showOnlineStatus,
    } = req.body;

    // Kiểm tra privacy settings có tồn tại không
    const existingSettings = await prisma.userPrivacySetting.findUnique({
      where: { userId },
    });

    const updateData = {};
    if (isPrivate !== undefined) updateData.isPrivate = Boolean(isPrivate);
    if (whoCanMessage !== undefined) updateData.whoCanMessage = whoCanMessage;
    if (whoCanTagMe !== undefined) updateData.whoCanTagMe = whoCanTagMe;
    if (whoCanFindByUsername !== undefined) updateData.whoCanFindByUsername = whoCanFindByUsername;
    if (showOnlineStatus !== undefined) updateData.showOnlineStatus = Boolean(showOnlineStatus);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có dữ liệu để cập nhật',
      });
    }

    const updatedSettings = existingSettings
      ? await prisma.userPrivacySetting.update({
          where: { userId },
          data: updateData,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        })
      : await prisma.userPrivacySetting.create({
          data: {
            userId,
            ...updateData,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        });

    res.json({
      success: true,
      message: 'Đã cập nhật cài đặt quyền riêng tư',
      privacySettings: {
        isPrivate: updatedSettings.isPrivate,
        whoCanMessage: updatedSettings.whoCanMessage,
        whoCanTagMe: updatedSettings.whoCanTagMe,
        whoCanFindByUsername: updatedSettings.whoCanFindByUsername,
        showOnlineStatus: updatedSettings.showOnlineStatus,
      },
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật cài đặt quyền riêng tư',
    });
  }
};


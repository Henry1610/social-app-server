import {
  getPublicProfileService,
  updatePrivacySettingsService
} from "../../services/userService.js";

// GET /api/user/:username/profile
export const getPublicProfile = async (req, res) => {
  try {
    const userId = req.resolvedUserId;

    const result = await getPublicProfileService({ userId });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    return res.json({
      success: true,
      user: result.user
    });
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

    const result = await updatePrivacySettingsService({
      userId,
      privacySettings: {
        isPrivate,
        whoCanMessage,
        whoCanTagMe,
        whoCanFindByUsername,
        showOnlineStatus,
      }
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      message: result.message,
      privacySettings: result.privacySettings
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật cài đặt quyền riêng tư',
    });
  }
};


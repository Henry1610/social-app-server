import * as userRepository from "../repositories/userRepository.js";

//Get user by id (tự động throw error nếu không tìm thấy)
export const getUserById = async (id, errorMessage = 'Người dùng không tồn tại!') => {
    const user = await userRepository.findUserByIdWithSelect(id, {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        privacySettings: {
          select: {
            isPrivate: true,
            whoCanMessage: true,
            whoCanTagMe: true,
            whoCanFindByUsername: true,
            showOnlineStatus: true
          }
        }
    });
    
    if (!user) {
        const error = new Error(errorMessage);
        error.statusCode = 404;
        throw error;
    }
    
    return user;
};

/**
 * Lấy public profile của user
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, user?: Object, message?: string, statusCode?: number}>}
 */
export const getPublicProfileService = async ({ userId }) => {
  const user = await userRepository.findUserByIdWithSelect(userId, {
    id: true,
    username: true,
    fullName: true,
    avatarUrl: true,
    createdAt: true,
    isOnline: true,
    lastSeen: true,
    privacySettings: true
  });

  if (!user) {
    return {
      success: false,
      message: 'Không tìm thấy người dùng',
      statusCode: 404
    };
  }

  return {
    success: true,
    user
  };
};

/**
 * Cập nhật privacy settings của user
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @param {Object} options.privacySettings - Privacy settings to update
 * @returns {Promise<{success: boolean, privacySettings?: Object, message?: string, statusCode?: number}>}
 */
export const updatePrivacySettingsService = async ({ userId, privacySettings }) => {
  const {
    isPrivate,
    whoCanMessage,
    whoCanTagMe,
    whoCanFindByUsername,
    showOnlineStatus,
  } = privacySettings;

  // Kiểm tra privacy settings có tồn tại không
  const existingSettings = await userRepository.findUserPrivacySetting(userId);

  const updateData = {};
  if (isPrivate !== undefined) updateData.isPrivate = Boolean(isPrivate);
  if (whoCanMessage !== undefined) updateData.whoCanMessage = whoCanMessage;
  if (whoCanTagMe !== undefined) updateData.whoCanTagMe = whoCanTagMe;
  if (whoCanFindByUsername !== undefined) updateData.whoCanFindByUsername = whoCanFindByUsername;
  if (showOnlineStatus !== undefined) updateData.showOnlineStatus = Boolean(showOnlineStatus);

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      message: 'Không có dữ liệu để cập nhật',
      statusCode: 400
    };
  }

  const updatedSettings = existingSettings
    ? await userRepository.updateUserPrivacySetting(userId, updateData, {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      })
    : await userRepository.createUserPrivacySetting(userId, updateData, {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      });

  return {
    success: true,
    message: 'Đã cập nhật cài đặt quyền riêng tư',
    privacySettings: {
      isPrivate: updatedSettings.isPrivate,
      whoCanMessage: updatedSettings.whoCanMessage,
      whoCanTagMe: updatedSettings.whoCanTagMe,
      whoCanFindByUsername: updatedSettings.whoCanFindByUsername,
      showOnlineStatus: updatedSettings.showOnlineStatus,
    },
  };
};
  


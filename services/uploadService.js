import cloudinary from '../config/cloudinary.js'
import { checkConversationAccess } from './conversationService.js'
import * as userRepository from '../repositories/userRepository.js'

export const uploadBufferToCloudinary = (buffer, filename, mimetype, folder) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = { folder, resource_type: 'auto', filename_override: filename, use_filename: true, unique_filename: true }
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error)
      resolve(result)
    })
    stream.end(buffer)
  })
}

/**
 * Upload chat media files
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @param {number} options.conversationId - ID của conversation
 * @param {Array} options.files - Array of file objects từ multer
 * @returns {Promise<{success: boolean, data?: Object, message?: string, statusCode?: number}>}
 */
export const uploadChatMediaService = async ({ userId, conversationId, files }) => {
  if (!conversationId) {
    return {
      success: false,
      message: 'Thiếu conversationId',
      statusCode: 400
    };
  }

  const hasAccess = await checkConversationAccess(userId, conversationId);
  if (!hasAccess) {
    return {
      success: false,
      message: 'Không có quyền truy cập cuộc trò chuyện này',
      statusCode: 403
    };
  }

  if (!files || files.length === 0) {
    return {
      success: false,
      message: 'Không có file',
      statusCode: 400
    };
  }

  const now = new Date();
  const folder = `chat/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  const results = [];
  for (const f of files) {
    try {
      const uploaded = await uploadBufferToCloudinary(f.buffer, f.originalname, f.mimetype, folder);
      
      // Xác định type của file
      let fileType = 'FILE';
      if (f.mimetype.startsWith('image/')) {
        fileType = 'IMAGE';
      } else if (f.mimetype.startsWith('video/')) {
        fileType = 'VIDEO';
      }
      
      results.push({
        url: uploaded.secure_url,
        type: fileType,
        mediaType: f.mimetype,
        filename: f.originalname,
        size: f.size,
        width: uploaded.width || null,
        height: uploaded.height || null,
        duration: uploaded.duration || null,
      });
    } catch (error) {
      if (error.message === 'INVALID_FILE_TYPE') {
        return {
          success: false,
          message: 'Định dạng không hợp lệ',
          statusCode: 400
        };
      }
      throw error;
    }
  }

  return {
    success: true,
    data: { files: results }
  };
};

/**
 * Upload post media files
 * @param {Object} options - Các options
 * @param {Array} options.files - Array of file objects từ multer
 * @returns {Promise<{success: boolean, data?: Object, message?: string, statusCode?: number}>}
 */
export const uploadPostMediaService = async ({ files }) => {
  if (!files || files.length === 0) {
    return {
      success: false,
      message: 'Không có file',
      statusCode: 400
    };
  }

  const now = new Date();
  const folder = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;

  const results = [];
  for (const f of files) {
    try {
      if (!f.mimetype.startsWith('image/') && !f.mimetype.startsWith('video/')) {
        continue; // Bỏ qua file không phải ảnh/video
      }
      
      const uploaded = await uploadBufferToCloudinary(f.buffer, f.originalname, f.mimetype, folder);
      results.push({
        url: uploaded.secure_url,
        type: f.mimetype.startsWith('video/') ? 'video' : 'image',
        mediaType: f.mimetype,
        width: uploaded.width || null,
        height: uploaded.height || null,
        duration: uploaded.duration || null,
      });
    } catch (error) {
      if (error.message === 'INVALID_FILE_TYPE') {
        return {
          success: false,
          message: 'Định dạng không hợp lệ',
          statusCode: 400
        };
      }
      throw error;
    }
  }

  return {
    success: true,
    data: { files: results }
  };
};

/**
 * Upload avatar và cập nhật user
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @param {Object} options.file - File object từ multer
 * @returns {Promise<{success: boolean, user?: Object, message?: string, statusCode?: number}>}
 */
export const uploadAvatarService = async ({ userId, file }) => {
  if (!file) {
    return {
      success: false,
      message: 'Không có file',
      statusCode: 400
    };
  }
  
  if (!file.mimetype.startsWith('image/')) {
    return {
      success: false,
      message: 'Chỉ chấp nhận file ảnh',
      statusCode: 400
    };
  }

  try {
    const folder = `avatars/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const uploaded = await uploadBufferToCloudinary(file.buffer, file.originalname, file.mimetype, folder);
    
    const updatedUser = await userRepository.updateUser(
      userId,
      { avatarUrl: uploaded.secure_url },
      {
        id: true,
        username: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        provider: true,
        facebookId: true,
        privacySettings: {
          select: {
            isPrivate: true,
            whoCanMessage: true,
            whoCanTagMe: true,
            whoCanFindByUsername: true,
            showOnlineStatus: true,
          },
        },
      }
    );

    return {
      success: true,
      user: updatedUser
    };
  } catch (error) {
    if (error.message === 'INVALID_FILE_TYPE') {
      return {
        success: false,
        message: 'Định dạng không hợp lệ',
        statusCode: 400
      };
    }
    throw error;
  }
};


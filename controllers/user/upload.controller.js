import {
  uploadChatMediaService,
  uploadPostMediaService,
  uploadAvatarService
} from '../../services/uploadService.js'

export const uploadChatMedia = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.body;
    const files = req.files || [];

    const result = await uploadChatMediaService({
      userId,
      conversationId,
      files
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (err) {
    console.error('Upload chat media error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Upload thất bại'
    });
  }
}

export const uploadPostMedia = async (req, res) => {
  try {
    const files = req.files || [];

    const result = await uploadPostMediaService({ files });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (err) {
    console.error('Upload post media error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Upload thất bại'
    });
  }
}

export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    const result = await uploadAvatarService({
      userId,
      file
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      user: result.user
    });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Upload thất bại'
    });
  }
}

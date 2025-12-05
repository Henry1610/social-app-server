import { uploadBufferToCloudinary } from '../../services/uploadService.js'
import { checkConversationAccess } from '../../services/conversationService.js'
import prisma from '../../utils/prisma.js'

export const uploadChatMedia = async (req, res) => {
  try {
    const userId = req.user.id
    const { conversationId } = req.body
    if (!conversationId) return res.status(400).json({ success: false, message: 'Thiếu conversationId' })

    const hasAccess = await checkConversationAccess(userId, conversationId)
    if (!hasAccess) return res.status(403).json({ success: false, message: 'Không có quyền truy cập cuộc trò chuyện này' })

    const files = req.files || []
    if (files.length === 0) return res.status(400).json({ success: false, message: 'Không có file' })

    const now = new Date()
    const folder = `chat/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`

    const results = []
    for (const f of files) {
      const uploaded = await uploadBufferToCloudinary(f.buffer, f.originalname, f.mimetype, folder)
      results.push({
        url: uploaded.secure_url,
        type: f.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        mediaType: f.mimetype,
        width: uploaded.width || null,
        height: uploaded.height || null,
        duration: uploaded.duration || null,
      })
    }

    res.json({ success: true, data: { files: results } })
  } catch (err) {
    if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ success: false, message: 'Định dạng không hợp lệ' })
    res.status(500).json({ success: false, message: err?.message || 'Upload thất bại' })
  }
}

export const uploadPostMedia = async (req, res) => {
  try {
    const files = req.files || []
    if (files.length === 0) return res.status(400).json({ success: false, message: 'Không có file' })

    const now = new Date()
    const folder = `posts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`

    const results = []
    for (const f of files) {
      if (!f.mimetype.startsWith('image/') && !f.mimetype.startsWith('video/')) {
        continue // Bỏ qua file không phải ảnh/video
      }
      const uploaded = await uploadBufferToCloudinary(f.buffer, f.originalname, f.mimetype, folder)
      results.push({
        url: uploaded.secure_url,
        type: f.mimetype.startsWith('video/') ? 'video' : 'image',
        mediaType: f.mimetype,
        width: uploaded.width || null,
        height: uploaded.height || null,
        duration: uploaded.duration || null,
      })
    }

    res.json({ success: true, data: { files: results } })
  } catch (err) {
    if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ success: false, message: 'Định dạng không hợp lệ' })
    res.status(500).json({ success: false, message: err?.message || 'Upload thất bại' })
  }
}

export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id
    const file = req.file
    
    if (!file) return res.status(400).json({ success: false, message: 'Không có file' })
    
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'Chỉ chấp nhận file ảnh' })
    }

    const folder = `avatars/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const uploaded = await uploadBufferToCloudinary(file.buffer, file.originalname, file.mimetype, folder)
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: uploaded.secure_url },
      select: {
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
      },
    })

    res.json({ success: true, user: updatedUser })
  } catch (err) {
    if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ success: false, message: 'Định dạng không hợp lệ' })
    res.status(500).json({ success: false, message: err?.message || 'Upload thất bại' })
  }
}

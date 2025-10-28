import prisma from "../../utils/prisma.js";
import { checkConversationAccess } from "../../services/conversationService.js";
import {
  checkMessageOwnership,
  getMessagesWithAccess,
  toggleMessageReaction as toggleMessageReactionService,
  togglePinMessage as togglePinMessageService,
  getPinnedMessages as getPinnedMessagesService,
} from "../../services/messageService.js";


// Lấy danh sách tin nhắn trong conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    const result = await getMessagesWithAccess(userId, conversationId, { page, limit });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    if (error.message.includes('quyền truy cập')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách tin nhắn',
    });
  }
};


// Chỉnh sửa tin nhắn
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Tìm tin nhắn và kiểm tra quyền chỉnh sửa
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
      include: { sender: true },
    });

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn',
      });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa tin nhắn này',
      });
    }

    // Chỉ cho phép chỉnh sửa tin nhắn text (không cho phép edit media messages)
    if (message.type !== 'TEXT') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể chỉnh sửa tin nhắn văn bản',
      });
    }

    // Kiểm tra nội dung mới có khác nội dung cũ không
    if (content.trim() === message.content?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung mới phải khác nội dung cũ',
      });
    }

    // Lưu lịch sử chỉnh sửa trước khi cập nhật
    if (message.content) {
      await prisma.messageEditHistory.create({
        data: {
          messageId: parseInt(messageId),
          oldContent: message.content,
          newContent: content.trim(),
          editedBy: userId,
        },
      });
    }

    // Cập nhật tin nhắn
    const updatedMessage = await prisma.message.update({
      where: { id: parseInt(messageId) },
      data: {
        content: content.trim(),
        updatedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        editHistory: {
          include: {
            editor: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
          orderBy: {
            editedAt: 'asc',
          },
        },
      },
    });

    res.json({
      success: true,
      data: { message: updatedMessage },
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi chỉnh sửa tin nhắn',
    });
  }
};

// Xóa tin nhắn
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Tìm tin nhắn và kiểm tra quyền xóa
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
      include: { sender: true },
    });

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn',
      });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa tin nhắn này',
      });
    }

    // Soft delete tin nhắn
    await prisma.message.update({
      where: { id: parseInt(messageId) },
      data: {
        deletedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Đã xóa tin nhắn',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi xóa tin nhắn',
    });
  }
};


// Lấy trạng thái đọc của tin nhắn
export const getMessageStates = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Tìm tin nhắn và kiểm tra quyền truy cập
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
    });

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn',
      });
    }

    const conversationMember = await prisma.conversationMember.findFirst({
      where: {
        conversationId: message.conversationId,
        userId,
        leftAt: null,
      },
    });

    if (!conversationMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      });
    }

    const states = await prisma.messageState.findMany({
      where: { messageId: parseInt(messageId) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { states },
    });
  } catch (error) {
    console.error('Error getting message states:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy trạng thái tin nhắn',
    });
  }
};

// React tin nhắn (thêm/xóa emoji)
export const toggleMessageReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Kiểm tra quyền truy cập conversation thông qua message
    const message = await checkMessageOwnership(userId, messageId);
    if (!message) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      });
    }

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn',
      });
    }

    // Toggle reaction bằng hàm từ service
    const result = await toggleMessageReactionService(messageId, userId, emoji);

    res.json({
      success: true,
      message: `Đã ${result.action === 'removed' ? 'xóa' : result.action === 'updated' ? 'cập nhật' : 'thêm'} reaction`,
      data: { action: result.action, emoji: result.emoji },
    });
  } catch (error) {
    console.error('Error toggling message reaction:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi cập nhật reaction',
    });
  }
};

// Lấy lịch sử chỉnh sửa của tin nhắn
export const getMessageEditHistory = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Kiểm tra quyền truy cập conversation thông qua message
    const message = await checkMessageOwnership(userId, messageId);
    if (!message) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      });
    }

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn',
      });
    }

    const editHistory = await prisma.messageEditHistory.findMany({
      where: { messageId: parseInt(messageId) },
      include: {
        editor: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        editedAt: 'asc',
      },
    });

    res.json({
      success: true,
      data: { editHistory },
    });
  } catch (error) {
    console.error('Error getting message edit history:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy lịch sử chỉnh sửa',
    });
  }
};

// Lấy danh sách reactions của tin nhắn
export const getMessageReactions = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Tìm tin nhắn và kiểm tra quyền truy cập
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
    });

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn',
      });
    }

    const conversationMember = await prisma.conversationMember.findFirst({
      where: {
        conversationId: message.conversationId,
        userId,
        leftAt: null,
      },
    });

    if (!conversationMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      });
    }

    const reactions = await prisma.messageReaction.findMany({
      where: { messageId: parseInt(messageId) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { reactions },
    });
  } catch (error) {
    console.error('Error getting message reactions:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách reactions',
    });
  }
};

// Ghim/bỏ ghim tin nhắn
export const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Kiểm tra quyền truy cập conversation thông qua message
    const message = await checkMessageOwnership(userId, messageId);
    if (!message) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      });
    }

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin nhắn',
      });
    }

    // Toggle pin message bằng hàm từ service
    const result = await togglePinMessageService(messageId, userId);

    res.json({
      success: true,
      message: `Đã ${result.action === 'unpinned' ? 'bỏ ghim' : 'ghim'} tin nhắn`,
      data: { action: result.action },
    });
  } catch (error) {
    console.error('Error toggling pin message:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi ghim tin nhắn',
    });
  }
};


// Lấy danh sách tin nhắn được ghim trong conversation
export const getPinnedMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Lấy danh sách tin nhắn được ghim bằng hàm từ service
    const pinnedMessages = await getPinnedMessagesService(userId, conversationId);

    res.json({
      success: true,
      data: { pinnedMessages },
    });
  } catch (error) {
    console.error('Error getting pinned messages:', error);
    if (error.message.includes('quyền truy cập')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách tin nhắn được ghim',
    });
  }
};

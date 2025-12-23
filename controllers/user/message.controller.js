import { getIO } from "../../config/socket.js";
import {
  getMessagesWithAccess,
  deleteMessageService,
  getMessageStatesService,
  getMessageEditHistoryService,
  togglePinMessageWithDetailsService,
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

// Xóa tin nhắn
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await deleteMessageService({
      messageId: parseInt(messageId),
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

    const result = await getMessageStatesService({
      messageId: parseInt(messageId),
      userId
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      data: { states: result.states }
    });
  } catch (error) {
    console.error('Error getting message states:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy trạng thái tin nhắn',
    });
  }
};


// Lấy lịch sử chỉnh sửa của tin nhắn
export const getMessageEditHistory = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await getMessageEditHistoryService({
      messageId: parseInt(messageId),
      userId
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.json({
      success: true,
      data: { editHistory: result.editHistory }
    });
  } catch (error) {
    console.error('Error getting message edit history:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy lịch sử chỉnh sửa',
    });
  }
};

// Ghim/bỏ ghim tin nhắn
export const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await togglePinMessageWithDetailsService({
      messageId: parseInt(messageId),
      userId
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        message: result.errorMessage
      });
    }

    // Emit socket event
    if (result.message) {
      const io = getIO();
      io.to(`conversation_${result.conversationId}`).emit('chat:message_pinned', {
        message: result.message,
        action: result.action,
        conversationId: result.conversationId,
      });
    }

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

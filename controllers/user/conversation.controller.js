import {
  checkConversationAccess,
  getConversationWithAccess,
  fetchConversations,
  getConversationMembersList,
  createDirectConversationService,
  createGroupConversationService,
  addMemberToConversationService,
  removeMemberFromConversationService,
  findUserByIdWithSelect,
} from "../../services/conversationService.js";
import { createSystemMessage } from "../../services/systemMessageService.js";


// Lấy danh sách conversations của user hiện tại
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Lấy conversations bằng service
    const { conversations, totalCount } = await fetchConversations(userId, { page, limit });

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách cuộc trò chuyện',
    });
  }
};

// Tạo conversation mới
export const createConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'DIRECT', participantIds, participantUsername, name, avatarUrl } = req.body;

    // Validate type
    if (type !== 'DIRECT' && type !== 'GROUP') {
      return res.status(400).json({
        success: false,
        message: 'Type conversation không hợp lệ',
      });
    }

    let result;
    if (type === 'DIRECT') {
      result = await createDirectConversationService(userId, participantUsername, participantIds);
    } else {
      result = await createGroupConversationService(userId, { name, avatarUrl, participantIds });
      
      // Tạo tin nhắn hệ thống khi tạo nhóm
      if (result.success && result.conversation) {
        const creator = await findUserByIdWithSelect(userId, {
          id: true,
          username: true,
          fullName: true
        });

        if (creator) {
          await createSystemMessage(result.conversation.id, 'GROUP_CREATED', {
            createdBy: creator.fullName || creator.username,
            groupName: name || 'Nhóm chat'
          });
        }
      }
    }

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        message: result.message,
      });
    }

    if (result.exists) {
      return res.json({
        success: true,
        data: { conversation: result.conversation },
        message: result.message,
      });
    }

    res.status(201).json({
      success: true,
      data: { conversation: result.conversation },
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi tạo cuộc trò chuyện',
    });
  }
};

// Lấy thông tin conversation chi tiết
export const getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await getConversationWithAccess(userId, conversationId, {
      members: {
        where: {
          leftAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
      creator: {
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện',
      });
    }

    res.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy thông tin cuộc trò chuyện',
    });
  }
};

// Lấy danh sách members của conversation
export const getConversationMembers = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Kiểm tra quyền truy cập conversation
    const hasAccess = await checkConversationAccess(userId, conversationId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      });
    }

    // Lấy danh sách members bằng service
    const members = await getConversationMembersList(conversationId);

    res.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    console.error('Error getting conversation members:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi lấy danh sách thành viên',
    });
  }
};

// Thêm member vào conversation (chỉ admin)
export const addMember = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId: newMemberId } = req.body;
    const currentUserId = req.user.id;

    const result = await addMemberToConversationService(conversationId, newMemberId, currentUserId);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      data: { member: result.member },
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi thêm thành viên',
    });
  }
};

// Xóa member khỏi conversation
export const removeMember = async (req, res) => {
  try {
    const { conversationId, userId: memberIdToRemove } = req.params;
    const currentUserId = req.user.id;

    const result = await removeMemberFromConversationService(conversationId, memberIdToRemove, currentUserId);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi xóa thành viên',
    });
  }
};

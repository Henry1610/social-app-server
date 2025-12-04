import prisma from "../../utils/prisma.js";
import {
  checkConversationAccess,
  checkAdminPermission,
  getConversationWithAccess,
  findOrCreateDirectConversation,
  fetchConversations,
  createGroupConversation,
  getConversationMembersList,
  addConversationMember,
  removeConversationMember,
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

    let participantId;

    // Xử lý validation dựa trên type
    if (type === 'DIRECT') {
      // DIRECT conversation cần 1 participant
      if (participantUsername) {
        const participant = await prisma.user.findUnique({
          where: { username: participantUsername },
          select: { id: true }
        });

        if (!participant) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy người dùng với username này',
          });
        }

        participantId = participant.id;
      } else if (participantIds && participantIds.length === 1) {
        participantId = participantIds[0];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Cần cung cấp participantUsername hoặc participantIds cho chat 1-1',
        });
      }
    } else if (type === 'GROUP') {
      // GROUP conversation cần ít nhất 2 participants
      if (!participantIds || participantIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Đối với nhóm chat, cần ít nhất 2 người tham gia',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Type conversation không hợp lệ',
      });
    }

    // Kiểm tra và tạo conversation
    let conversation;
    if (type === 'DIRECT') {
      conversation = await findOrCreateDirectConversation(userId, participantId);
      if (conversation && conversation.id) {
        return res.json({
          success: true,
          data: { conversation },
          message: 'Conversation đã tồn tại',
        });
      }
    } else {
      // Tạo GROUP conversation mới bằng service
      conversation = await createGroupConversation({
        createdBy: userId,
        name,
        avatarUrl,
        participantIds
      });

      // Tạo tin nhắn hệ thống khi tạo nhóm
      const creator = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          fullName: true
        }
      });

      if (creator) {
        await createSystemMessage(conversation.id, 'GROUP_CREATED', {
          createdBy: creator.fullName || creator.username,
          groupName: name || 'Nhóm chat'
        });
      }
    }

    res.status(201).json({
      success: true,
      data: { conversation },
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

    // Kiểm tra quyền admin
    const currentUserMember = await checkAdminPermission(currentUserId, conversationId);
    if (!currentUserMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm thành viên vào nhóm này',
      });
    }

    // Kiểm tra user mới có tồn tại không
    const newMember = await prisma.user.findUnique({
      where: { id: newMemberId },
    });

    if (!newMember) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    // Kiểm tra user mới đã là member chưa
    const existingMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: parseInt(conversationId),
          userId: newMemberId,
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'Người dùng đã là thành viên của nhóm',
      });
    }

    // Thêm member mới bằng service
    const newMemberRecord = await addConversationMember({
      conversationId,
      userId: newMemberId,
      role: 'MEMBER'
    });

    res.json({
      success: true,
      data: { member: newMemberRecord },
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

    // Kiểm tra quyền truy cập conversation
    const currentUserMember = await checkConversationAccess(currentUserId, conversationId);
    if (!currentUserMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của nhóm này',
      });
    }

    // Chỉ admin mới được xóa member khác
    if (memberIdToRemove != currentUserId && currentUserMember.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa thành viên này',
      });
    }

    // Xóa member bằng service (soft delete)
    await removeConversationMember({
      conversationId,
      userId: memberIdToRemove
    });

    res.json({
      success: true,
      message: 'Đã xóa thành viên khỏi nhóm',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra khi xóa thành viên',
    });
  }
};

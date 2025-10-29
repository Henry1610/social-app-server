import prisma from "../../utils/prisma.js";
import {
  checkConversationAccess,
  checkAdminPermission,
  getConversationWithAccess,
  findOrCreateDirectConversation,
} from "../../services/conversationService.js";


// Lấy danh sách conversations của user hiện tại
export const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Lấy conversations mà user là thành viên và đã có tin nhắn
    const conversations = await prisma.conversation.findMany({
      where: {
        members: {
          some: {
            userId: userId,
            leftAt: null, // Chưa rời khỏi conversation
          },
        },
        messages: {
          some: {}, // Có ít nhất 1 tin nhắn
        },
      },
      include: {
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
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
        // Lấy tin nhắn cuối cùng
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        // Đếm số tin nhắn chưa đọc (chỉ tin nhắn không phải của user hiện tại)
        _count: {
          select: {
            messages: {
              where: {
                senderId: {
                  not: userId, // Chỉ đếm tin nhắn không phải của user hiện tại
                },
                states: {
                  some: {
                    userId: userId,
                    status: {
                      in: ['SENT', 'DELIVERED'] // Đếm tin nhắn có status SENT hoặc DELIVERED (chưa đọc)
                    },
                  },
                },
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    });

    // Đếm tổng số conversations có tin nhắn
    const totalCount = await prisma.conversation.count({
      where: {
        members: {
          some: {
            userId: userId,
            leftAt: null,
          },
        },
        messages: {
          some: {}, // Có ít nhất 1 tin nhắn
        },
      },
    });

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
      // Tạo GROUP conversation mới
      conversation = await prisma.conversation.create({
        data: {
          type,
          name,
          avatarUrl,
          createdBy: userId,
          members: {
            create: [
              // Thêm người tạo vào conversation
              {
                userId,
                role: 'ADMIN',
              },
              // Thêm các participant khác
              ...participantIds.map((participantId) => ({
                userId: participantId,
                role: 'MEMBER',
              })),
            ],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  avatarUrl: true,
                  isOnline: true,
                  lastSeen: true,
                },
              },
            },
          },
        },
      });
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

    const members = await prisma.conversationMember.findMany({
      where: {
        conversationId: parseInt(conversationId),
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
    });

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

    // Thêm member mới
    const newMemberRecord = await prisma.conversationMember.create({
      data: {
        conversationId: parseInt(conversationId),
        userId: newMemberId,
        role: 'MEMBER',
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

    // Cập nhật thời gian rời khỏi nhóm
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: parseInt(conversationId),
          userId: parseInt(memberIdToRemove),
        },
      },
      data: {
        leftAt: new Date(),
      },
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

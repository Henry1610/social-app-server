import { getUserById } from "./userService.js";
import * as userRepository from "../repositories/userRepository.js";
import * as conversationRepository from "../repositories/conversationRepository.js";

/**
 * Tìm user theo username
 * @param {string} username - Username của user
 * @returns {Promise<Object|null>} User object với id hoặc null
 */
export const findUserByUsername = async (username) => {
  return await userRepository.findUserByUsername(username, { id: true });
};

/**
 * Tìm user theo id với các fields cụ thể
 * @param {number} userId - ID của user
 * @param {Object} select - Fields cần select
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserByIdWithSelect = async (userId, select = {
  id: true,
  username: true,
  fullName: true
}) => {
  return await userRepository.findUserByIdWithSelect(userId, select);
};

/**
 * Kiểm tra conversation member đã tồn tại chưa
 * @param {number} conversationId - ID của conversation
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} ConversationMember object hoặc null
 */
export const findConversationMember = async (conversationId, userId) => {
  return await conversationRepository.findConversationMember(conversationId, userId);
};

/**
 * Kiểm tra và validate để tạo DIRECT conversation
 * @param {string} participantUsername - Username của participant
 * @param {Array<number>} participantIds - Array của participant IDs
 * @returns {Promise<{participantId: number}|null>} Object với participantId hoặc null nếu không hợp lệ
 */
export const validateDirectConversationParticipant = async (participantUsername, participantIds) => {
  let participantId;

  if (participantUsername) {
    const participant = await findUserByUsername(participantUsername);
    if (!participant) {
      return {
        success: false,
        message: 'Không tìm thấy người dùng với username này',
        statusCode: 404
      };
    }
    participantId = participant.id;
  } else if (participantIds && participantIds.length === 1) {
    participantId = participantIds[0];
  } else {
    return {
      success: false,
      message: 'Cần cung cấp participantUsername hoặc participantIds cho chat 1-1',
      statusCode: 400
    };
  }

  return {
    success: true,
    participantId
  };
};

/**
 * Validate để tạo GROUP conversation
 * @param {Array<number>} participantIds - Array của participant IDs
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const validateGroupConversationParticipants = (participantIds) => {
  if (!participantIds || participantIds.length < 2) {
    return {
      success: false,
      message: 'Đối với nhóm chat, cần ít nhất 2 người tham gia',
      statusCode: 400
    };
  }
  return { success: true };
};

/**
 * Kiểm tra user có tồn tại không
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const checkUserExists = async (userId) => {
  return await userRepository.findUserById(userId);
};

export const checkConversationAccess = async (userId, conversationId) => {
  return await conversationRepository.findConversationMemberByAccess(conversationId, userId);
};

export const checkAdminPermission = async (userId, conversationId) => {
  return await conversationRepository.findConversationMemberByAdmin(conversationId, userId);
};

export const getConversationWithAccess = async (userId, conversationId, include = {}) => {
  return await conversationRepository.findConversationWithAccess(userId, conversationId, include);
};

export const findOrCreateDirectConversation = async (userId, participantId) => {
  // Kiểm tra conversation đã tồn tại chưa
  const existingConversation = await conversationRepository.findDirectConversationByMembers(
    userId,
    participantId,
    {
      members: {
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
    }
  );

  if (existingConversation) {
    return existingConversation;
  }

  // Tạo conversation mới
  return await conversationRepository.createConversation(
    {
      type: 'DIRECT',
      createdBy: userId,
      members: [
        {
          userId,
          role: 'MEMBER',
        },
        {
          userId: participantId,
          role: 'MEMBER',
        },
      ],
    },
    {
      members: {
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
    }
  );
};

/**
 * Lấy danh sách conversations của user với pagination
 * @param {number} userId - ID của user
 * @param {Object} options - Các options
 * @param {number} options.page - Số trang (mặc định: 1)
 * @param {number} options.limit - Số lượng items mỗi trang (mặc định: 20)
 * @returns {Promise<{conversations: Array, totalCount: number}>}
 */
export const fetchConversations = async (userId, { page = 1, limit = 20 } = {}) => {
  const conversations = await conversationRepository.findConversationsByUserId(userId, {
    page,
    limit,
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
              privacySettings: {
                select: {
                  showOnlineStatus: true,
                },
              },
            },
          },
        },
      },
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
      _count: {
        select: {
          messages: {
            where: {
              senderId: {
                not: userId,
              },
              states: {
                some: {
                  userId: userId,
                  status: {
                    in: ['SENT', 'DELIVERED']
                  },
                },
              },
              deletedAt: null,
            },
          },
        },
      },
    },
  });

  const totalCount = await conversationRepository.countConversationsByUserId(userId);

  return {
    conversations,
    totalCount
  };
};

/**
 * Tạo GROUP conversation mới
 * @param {Object} options - Các options
 * @param {number} options.createdBy - ID của user tạo nhóm
 * @param {string} options.name - Tên nhóm
 * @param {string} options.avatarUrl - Avatar nhóm
 * @param {Array<number>} options.participantIds - Danh sách ID của participants
 * @returns {Promise<Object>} Conversation object đã được tạo
 */
export const createGroupConversation = async ({ createdBy, name, avatarUrl, participantIds }) => {
  return await conversationRepository.createConversation(
    {
      type: 'GROUP',
      name,
      avatarUrl,
      createdBy,
      members: [
        {
          userId: createdBy,
          role: 'ADMIN',
        },
        ...participantIds.map((participantId) => ({
          userId: participantId,
          role: 'MEMBER',
        })),
      ],
    },
    {
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
    }
  );
};

/**
 * Lấy danh sách members của conversation
 * @param {number} conversationId - ID của conversation
 * @returns {Promise<Array>} Danh sách members
 */
export const getConversationMembersList = async (conversationId) => {
  return await conversationRepository.findConversationMembersByConversationId(conversationId, {
    user: {
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        privacySettings: {
          select: {
            whoCanMessage: true,
            showOnlineStatus: true,
          },
        },
      },
    },
  });
};

/**
 * Thêm member vào conversation
 * @param {Object} options - Các options
 * @param {number} options.conversationId - ID của conversation
 * @param {number} options.userId - ID của user cần thêm
 * @param {string} options.role - Role của member (mặc định: 'MEMBER')
 * @returns {Promise<Object>} Member record đã được tạo
 */
export const addConversationMember = async ({ conversationId, userId, role = 'MEMBER' }) => {
  return await conversationRepository.createConversationMember(
    {
      conversationId,
      userId,
      role,
    },
    {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    }
  );
};

/**
 * Xóa member khỏi conversation (soft delete - set leftAt)
 * @param {Object} options - Các options
 * @param {number} options.conversationId - ID của conversation
 * @param {number} options.userId - ID của user cần xóa
 * @returns {Promise<void>}
 */
export const removeConversationMember = async ({ conversationId, userId }) => {
  await conversationRepository.updateConversationMember(conversationId, userId, {
    leftAt: new Date(),
  });
};

/**
 * Tạo DIRECT conversation với validation
 * @param {number} userId - ID của user hiện tại
 * @param {string} participantUsername - Username của participant (optional)
 * @param {Array<number>} participantIds - Array của participant IDs (optional)
 * @returns {Promise<{success: boolean, conversation?: Object, message?: string, exists?: boolean, statusCode?: number}>}
 */
export const createDirectConversationService = async (userId, participantUsername, participantIds) => {
  // Validate participant
  const validation = await validateDirectConversationParticipant(participantUsername, participantIds);
  if (!validation.success) {
    return validation;
  }

  const { participantId } = validation;

  // Tìm hoặc tạo conversation
  const conversation = await findOrCreateDirectConversation(userId, participantId);
  
  if (conversation && conversation.id) {
    return {
      success: true,
      conversation,
      exists: true,
      message: 'Conversation đã tồn tại'
    };
  }

  return {
    success: true,
    conversation,
    exists: false
  };
};

/**
 * Tạo GROUP conversation với validation
 * @param {number} userId - ID của user tạo nhóm
 * @param {Object} data - Dữ liệu để tạo nhóm
 * @param {string} data.name - Tên nhóm
 * @param {string} data.avatarUrl - Avatar nhóm
 * @param {Array<number>} data.participantIds - Danh sách participant IDs
 * @returns {Promise<{success: boolean, conversation?: Object, message?: string, statusCode?: number}>}
 */
export const createGroupConversationService = async (userId, { name, avatarUrl, participantIds }) => {
  // Validate participants
  const validation = validateGroupConversationParticipants(participantIds);
  if (!validation.success) {
    return validation;
  }

  // Tạo conversation
  const conversation = await createGroupConversation({
    createdBy: userId,
    name,
    avatarUrl,
    participantIds
  });

  return {
    success: true,
    conversation
  };
};

/**
 * Thêm member vào conversation với validation
 * @param {number} conversationId - ID của conversation
 * @param {number} newMemberId - ID của user cần thêm
 * @param {number} currentUserId - ID của user hiện tại (để check permission)
 * @returns {Promise<{success: boolean, member?: Object, message?: string, statusCode?: number}>}
 */
export const addMemberToConversationService = async (conversationId, newMemberId, currentUserId) => {
  // Kiểm tra quyền admin
  const currentUserMember = await checkAdminPermission(currentUserId, conversationId);
  if (!currentUserMember) {
    return {
      success: false,
      message: 'Bạn không có quyền thêm thành viên vào nhóm này',
      statusCode: 403
    };
  }

  // Kiểm tra user mới có tồn tại không
  const newMember = await checkUserExists(newMemberId);
  if (!newMember) {
    return {
      success: false,
      message: 'Không tìm thấy người dùng',
      statusCode: 404
    };
  }

  // Kiểm tra user mới đã là member chưa
  const existingMember = await findConversationMember(conversationId, newMemberId);
  if (existingMember) {
    return {
      success: false,
      message: 'Người dùng đã là thành viên của nhóm',
      statusCode: 400
    };
  }

  // Thêm member mới
  const newMemberRecord = await addConversationMember({
    conversationId,
    userId: newMemberId,
    role: 'MEMBER'
  });

  return {
    success: true,
    member: newMemberRecord
  };
};

/**
 * Xóa member khỏi conversation với validation
 * @param {number} conversationId - ID của conversation
 * @param {number} memberIdToRemove - ID của member cần xóa
 * @param {number} currentUserId - ID của user hiện tại
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const removeMemberFromConversationService = async (conversationId, memberIdToRemove, currentUserId) => {
  // Kiểm tra quyền truy cập conversation
  const currentUserMember = await checkConversationAccess(currentUserId, conversationId);
  if (!currentUserMember) {
    return {
      success: false,
      message: 'Bạn không phải là thành viên của nhóm này',
      statusCode: 403
    };
  }

  // Chỉ admin mới được xóa member khác
  if (memberIdToRemove != currentUserId && currentUserMember.role !== 'ADMIN') {
    return {
      success: false,
      message: 'Bạn không có quyền xóa thành viên này',
      statusCode: 403
    };
  }

  // Xóa member (soft delete)
  await removeConversationMember({
    conversationId,
    userId: memberIdToRemove
  });

  return {
    success: true,
    message: 'Đã xóa thành viên khỏi nhóm'
  };
};
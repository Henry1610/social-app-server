import { checkConversationAccess } from "./conversationService.js";
import * as messageRepository from "../repositories/messageRepository.js";

export const checkMessageOwnership = async (userId, messageId) => {
  return await messageRepository.findMessageByIdWithSender(parseInt(messageId));
};

export const getMessagesWithAccess = async (userId, conversationId, options = {}) => {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  // Kiểm tra quyền truy cập
  const hasAccess = await checkConversationAccess(userId, conversationId);
  if (!hasAccess) {
    throw new Error('Bạn không có quyền truy cập cuộc trò chuyện này');
  }

  const messages = await messageRepository.findMessagesByConversationId(
    conversationId,
    {
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        states: true,
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
        pinnedIn: {
          select: {
            id: true,
            conversationId: true,
            pinnedAt: true,
            pinnedBy: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: parseInt(limit),
      skip: offset
    }
  );

  // Đếm tổng số tin nhắn
  const totalCount = await messageRepository.countMessagesByConversationId(conversationId);

  return {
    messages,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};


export const createMessageWithStates = async (conversationId, senderId, messageData) => {
  const { type = 'TEXT', content, mediaUrl, mediaType, filename, size, replyToId } = messageData;

  // Tạo tin nhắn mới
  const message = await messageRepository.createMessage(
    {
      conversationId: parseInt(conversationId),
      senderId,
      type,
      content,
      mediaUrl,
      mediaType,
      filename,
      fileSize: size ? parseInt(size) : null,
      replyToId: replyToId ? parseInt(replyToId) : null,
    },
    {
      sender: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    }
  );

  // Cập nhật thời gian tin nhắn cuối cùng của conversation
  await messageRepository.updateConversationLastMessageAt(
    conversationId,
    message.createdAt
  );

  // Tạo message state cho tất cả members khác (trừ sender)
  const conversationMembers = await messageRepository.findConversationMembers(
    {
      conversationId: parseInt(conversationId),
      userId: { not: senderId },
      leftAt: null,
    },
    {
      user: {
        select: {
          id: true,
          isOnline: true
        }
      }
    }
  );

  if (conversationMembers.length > 0) {
    // Chuẩn bị dữ liệu để tạo MessageState
    const messageStates = conversationMembers.map((member) => {
      // Nếu user đang online, set status = DELIVERED ngay
      // Nếu offline, set status = SENT
      const status = member.user.isOnline ? 'DELIVERED' : 'SENT';
      
      return {
        messageId: message.id,
        userId: member.userId,
        status: status,
      };
    });

    await messageRepository.createMessageStates(messageStates);
  }

  // Lấy thông tin đầy đủ của message để trả về
  const fullMessage = await messageRepository.findMessageById(message.id, {
    sender: {
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
      },
    },
    replyTo: {
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    },
  });

  return fullMessage;
};

export const markMessageAsRead = async (messageId, userId) => {
  return await messageRepository.upsertMessageState(parseInt(messageId), userId, {
    update: {
      status: 'READ',
      updatedAt: new Date(),
    },
    create: {
      status: 'READ',
    }
  });
};



export const togglePinMessage = async (messageId, userId) => {
  const message = await messageRepository.findMessageById(parseInt(messageId));

  if (!message || message.deletedAt) {
    throw new Error('Không tìm thấy tin nhắn');
  }

  // Kiểm tra xem tin nhắn đã được ghim chưa
  const existingPin = await messageRepository.findPinnedMessage(
    message.conversationId,
    parseInt(messageId)
  );

  if (existingPin) {
    // Bỏ ghim
    await messageRepository.deletePinnedMessage(
      message.conversationId,
      parseInt(messageId)
    );
    return { action: 'unpinned' };
  } else {
    // Ghim tin nhắn
    await messageRepository.createPinnedMessage({
      conversationId: message.conversationId,
      messageId: parseInt(messageId),
      pinnedById: userId,
    });
    return { action: 'pinned' };
  }
};


export const getPinnedMessages = async (userId, conversationId) => {
  // Kiểm tra quyền truy cập
  const hasAccess = await checkConversationAccess(userId, conversationId);
  if (!hasAccess) {
    throw new Error('Bạn không có quyền truy cập cuộc trò chuyện này');
  }

  return await messageRepository.findPinnedMessagesByConversationId(
    conversationId,
    {
      message: {
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      },
      pinnedBy: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    {
      pinnedAt: 'desc'
    }
  );
};

/**
 * Xóa message (soft delete)
 * @param {Object} options - Các options
 * @param {number} options.messageId - ID của message
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const deleteMessageService = async ({ messageId, userId }) => {
  // Tìm tin nhắn và kiểm tra quyền xóa
  const message = await messageRepository.findMessageById(parseInt(messageId), {
    sender: true
  });

  if (!message || message.deletedAt) {
    return {
      success: false,
      message: 'Không tìm thấy tin nhắn',
      statusCode: 404
    };
  }

  if (message.senderId !== userId) {
    return {
      success: false,
      message: 'Bạn không có quyền xóa tin nhắn này',
      statusCode: 403
    };
  }

  // Soft delete tin nhắn
  await messageRepository.softDeleteMessage(parseInt(messageId));

  return {
    success: true,
    message: 'Đã xóa tin nhắn'
  };
};

/**
 * Lấy message states (trạng thái đọc của message)
 * @param {Object} options - Các options
 * @param {number} options.messageId - ID của message
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, states?: Array, message?: string, statusCode?: number}>}
 */
export const getMessageStatesService = async ({ messageId, userId }) => {
  // Tìm tin nhắn và kiểm tra quyền truy cập
  const message = await messageRepository.findMessageById(parseInt(messageId));

  if (!message || message.deletedAt) {
    return {
      success: false,
      message: 'Không tìm thấy tin nhắn',
      statusCode: 404
    };
  }

  const conversationMember = await messageRepository.findConversationMember({
    conversationId: message.conversationId,
    userId,
    leftAt: null,
  });

  if (!conversationMember) {
    return {
      success: false,
      message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      statusCode: 403
    };
  }

  const states = await messageRepository.findMessageStatesByMessageId(
    parseInt(messageId),
    {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    }
  );

  return {
    success: true,
    states
  };
};

/**
 * Lấy edit history của message
 * @param {Object} options - Các options
 * @param {number} options.messageId - ID của message
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, editHistory?: Array, message?: string, statusCode?: number}>}
 */
export const getMessageEditHistoryService = async ({ messageId, userId }) => {
  // Kiểm tra quyền truy cập conversation thông qua message
  const message = await checkMessageOwnership(userId, messageId);
  
  if (!message) {
    return {
      success: false,
      message: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      statusCode: 403
    };
  }

  if (!message || message.deletedAt) {
    return {
      success: false,
      message: 'Không tìm thấy tin nhắn',
      statusCode: 404
    };
  }

  const editHistory = await messageRepository.findMessageEditHistoryByMessageId(
    parseInt(messageId),
    {
      editor: {
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    {
      editedAt: 'asc'
    }
  );

  return {
    success: true,
    editHistory
  };
};

/**
 * Toggle pin message và trả về message đầy đủ để emit socket
 * @param {Object} options - Các options
 * @param {number} options.messageId - ID của message
 * @param {number} options.userId - ID của user
 * @returns {Promise<{success: boolean, action?: string, message?: Object, conversationId?: number, errorMessage?: string, statusCode?: number}>}
 */
export const togglePinMessageWithDetailsService = async ({ messageId, userId }) => {
  // Kiểm tra quyền truy cập conversation thông qua message
  const message = await checkMessageOwnership(userId, messageId);
  
  if (!message) {
    return {
      success: false,
      errorMessage: 'Bạn không có quyền truy cập cuộc trò chuyện này',
      statusCode: 403
    };
  }

  if (!message || message.deletedAt) {
    return {
      success: false,
      errorMessage: 'Không tìm thấy tin nhắn',
      statusCode: 404
    };
  }

  const result = await togglePinMessage(messageId, userId);

  // Lấy message đầy đủ để emit socket
  const pinnedMessage = await messageRepository.findMessageById(parseInt(messageId), {
    sender: {
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
      },
    },
    pinnedIn: {
      include: {
        pinnedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    },
  });

  return {
    success: true,
    action: result.action,
    message: pinnedMessage,
    conversationId: pinnedMessage.conversationId
  };
};


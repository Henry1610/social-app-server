import prisma from "../utils/prisma.js";
import { checkConversationAccess } from "./conversationService.js";

export const checkMessageOwnership = async (userId, messageId) => {
  return await prisma.message.findUnique({
    where: { id: parseInt(messageId) },
    include: { sender: true },
  });
};

export const getMessagesWithAccess = async (userId, conversationId, options = {}) => {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  // Kiểm tra quyền truy cập
  const hasAccess = await checkConversationAccess(userId, conversationId);
  if (!hasAccess) {
    throw new Error('Bạn không có quyền truy cập cuộc trò chuyện này');
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId: parseInt(conversationId),
      deletedAt: null,
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
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
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
      _count: {
        select: {
          reactions: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: parseInt(limit),
    skip: offset,
  });

  // Đếm tổng số tin nhắn
  const totalCount = await prisma.message.count({
    where: {
      conversationId: parseInt(conversationId),
      deletedAt: null,
    },
  });

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
  const { type = 'TEXT', content, mediaUrl, replyToId } = messageData;

  // Tạo tin nhắn mới
  const message = await prisma.message.create({
    data: {
      conversationId: parseInt(conversationId),
      senderId,
      type,
      content,
      mediaUrl,
      replyToId: replyToId ? parseInt(replyToId) : null,
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
    },
  });

  // Cập nhật thời gian tin nhắn cuối cùng của conversation
  await prisma.conversation.update({
    where: { id: parseInt(conversationId) },
    data: {
      lastMessageAt: message.createdAt,
    },
  });

  // Tạo message state cho tất cả members khác (trừ sender)
  const conversationMembers = await prisma.conversationMember.findMany({
    where: {
      conversationId: parseInt(conversationId),
      userId: { not: senderId },
      leftAt: null,
    },
    select: { userId: true },
  });

  if (conversationMembers.length > 0) {
    await prisma.messageState.createMany({
      data: conversationMembers.map((member) => ({
        messageId: message.id,
        userId: member.userId,
        status: 'DELIVERED',
      })),
    });
  }

  // Tạo message state cho sender (SENT)
  await prisma.messageState.create({
    data: {
      messageId: message.id,
      userId: senderId,
      status: 'SENT',
    },
  });

  // Lấy thông tin đầy đủ của message để trả về
  const fullMessage = await prisma.message.findUnique({
    where: { id: message.id },
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
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  });

  return fullMessage;
};

export const markMessageAsRead = async (messageId, userId) => {
  return await prisma.messageState.upsert({
    where: {
      messageId_userId: {
        messageId: parseInt(messageId),
        userId,
      },
    },
    update: {
      status: 'READ',
      updatedAt: new Date(),
    },
    create: {
      messageId: parseInt(messageId),
      userId,
      status: 'READ',
    },
  });
};


export const toggleMessageReaction = async (messageId, userId, emoji) => {
  // Kiểm tra reaction đã tồn tại chưa
  const existingReaction = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId: {
        messageId: parseInt(messageId),
        userId,
      },
    },
  });

  if (existingReaction) {
    // Nếu reaction đã tồn tại và cùng emoji thì xóa, khác emoji thì cập nhật
    if (existingReaction.emoji === emoji) {
      await prisma.messageReaction.delete({
        where: {
          messageId_userId: {
            messageId: parseInt(messageId),
            userId,
          },
        },
      });
      return { action: 'removed', emoji };
    } else {
      // Cập nhật reaction khác
      await prisma.messageReaction.update({
        where: {
          messageId_userId: {
            messageId: parseInt(messageId),
            userId,
          },
        },
        data: { emoji },
      });
      return { action: 'updated', emoji };
    }
  } else {
    // Tạo reaction mới
    await prisma.messageReaction.create({
      data: {
        messageId: parseInt(messageId),
        userId,
        emoji,
      },
    });
    return { action: 'added', emoji };
  }
};

export const togglePinMessage = async (messageId, userId) => {
  const message = await prisma.message.findUnique({
    where: { id: parseInt(messageId) },
  });

  if (!message || message.deletedAt) {
    throw new Error('Không tìm thấy tin nhắn');
  }

  // Kiểm tra xem tin nhắn đã được ghim chưa
  const existingPin = await prisma.pinnedMessage.findUnique({
    where: {
      conversationId_messageId: {
        conversationId: message.conversationId,
        messageId: parseInt(messageId),
      },
    },
  });

  if (existingPin) {
    // Bỏ ghim
    await prisma.pinnedMessage.delete({
      where: {
        conversationId_messageId: {
          conversationId: message.conversationId,
          messageId: parseInt(messageId),
        },
      },
    });
    return { action: 'unpinned' };
  } else {
    // Ghim tin nhắn
    await prisma.pinnedMessage.create({
      data: {
        conversationId: message.conversationId,
        messageId: parseInt(messageId),
        pinnedById: userId,
      },
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

  return await prisma.pinnedMessage.findMany({
    where: { conversationId: parseInt(conversationId) },
    include: {
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
    orderBy: {
      pinnedAt: 'desc',
    },
  });
};

export const markConversationAsRead = async (userId, conversationId) => {
  // Kiểm tra quyền truy cập
  const hasAccess = await checkConversationAccess(userId, conversationId);
  if (!hasAccess) {
    throw new Error('Bạn không có quyền truy cập cuộc trò chuyện này');
  }

  // Lấy tất cả tin nhắn chưa đọc của user trong conversation
  const unreadMessages = await prisma.message.findMany({
    where: {
      conversationId: parseInt(conversationId),
      deletedAt: null,
      states: {
        none: {
          userId,
          status: 'READ',
        },
      },
    },
    select: { id: true },
  });

  if (unreadMessages.length === 0) {
    return 0;
  }

  // Cập nhật tất cả message states thành READ
  await prisma.messageState.updateMany({
    where: {
      messageId: {
        in: unreadMessages.map(msg => msg.id),
      },
      userId,
    },
    data: {
      status: 'READ',
      updatedAt: new Date(),
    },
  });

  return unreadMessages.length;
};

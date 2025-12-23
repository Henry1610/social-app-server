import { createNotification } from "./notificationService.js";
import * as commentRepository from "../repositories/commentRepository.js";
import * as reactionRepository from "../repositories/reactionRepository.js";
import * as postRepository from "../repositories/postRepository.js";
import * as repostRepository from "../repositories/repostRepository.js";

// Helper: User select fields (dùng chung cho nhiều queries)
const userSelectFields = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true
};

// Helper: Valid reaction types
const VALID_REACTION_TYPES = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];

/**
 * Tạo, cập nhật hoặc xóa reaction (toggle nếu cùng loại)
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @param {number} options.targetId - ID của target
 * @param {string} options.targetType - Type của target (POST, COMMENT, REPOST)
 * @param {string} options.type - Type của reaction (LIKE, LOVE, etc.)
 * @returns {Promise<{success: boolean, reaction?: Object|null, message?: string, statusCode?: number}>}
 */
export const createOrUpdateReactionService = async ({ userId, targetId, targetType, type }) => {
  // Validate input
  if (!targetId || !targetType) {
    return {
      success: false,
      message: "targetId và targetType là bắt buộc",
      statusCode: 400
    };
  }

  const reactionType = (type?.toUpperCase() || 'LIKE');
  if (!VALID_REACTION_TYPES.includes(reactionType)) {
    return {
      success: false,
      message: `Reaction type không hợp lệ. Chỉ chấp nhận: ${VALID_REACTION_TYPES.join(', ')}`,
      statusCode: 400
    };
  }

  const targetTypeUpper = targetType.toUpperCase();

  // Post và Repost chỉ hỗ trợ LIKE
  if ((targetTypeUpper === 'POST' || targetTypeUpper === 'REPOST') && reactionType !== 'LIKE') {
    return {
      success: false,
      message: "Post và Repost chỉ hỗ trợ reaction type LIKE",
      statusCode: 400
    };
  }

  // Tìm reaction hiện tại
  const existingReaction = await reactionRepository.findReactionByUserAndTarget(
    userId,
    targetTypeUpper,
    targetId
  );

  let reaction = null;

  if (!existingReaction) {
    // Chưa có reaction → tạo mới
    reaction = await reactionRepository.createReaction(
      {
        userId: Number(userId),
        targetId: Number(targetId),
        targetType: targetTypeUpper,
        reactionType: reactionType,
      },
      {
        user: { select: userSelectFields }
      }
    );

    // Tạo notification cho chủ sở hữu của target (nếu không phải chính họ react)
    try {
      let targetUserId = null;
      let metadata = null;

      if (targetTypeUpper === "POST") {
        const post = await postRepository.findPostByIdUnique(Number(targetId), {
          userId: true
        });
        targetUserId = post?.userId;
      } else if (targetTypeUpper === "COMMENT") {
        const comment = await commentRepository.findCommentById(Number(targetId), {
          select: { userId: true }
        });
        targetUserId = comment?.userId;
      } else if (targetTypeUpper === "REPOST") {
        const repost = await repostRepository.findRepostById(Number(targetId), {
          userId: true,
          postId: true,
          post: {
            select: { userId: true }
          }
        });
        
        if (repost) {
          targetUserId = repost.userId;
          // Thêm metadata để client có thể navigate đúng
          metadata = {
            repostId: Number(targetId),
            postId: repost.postId
          };
        }
      }

      if (targetUserId && targetUserId !== Number(userId)) {
        await createNotification({
          userId: targetUserId,
          actorId: Number(userId),
          type: "REACTION",
          targetType: targetTypeUpper,
          targetId: Number(targetId),
          metadata: metadata
        });
      }
    } catch (error) {
      console.error("Error creating notification in createOrUpdateReactionService:", error);
    }
  } else if (existingReaction.reactionType === reactionType) {
    // Đã có cùng loại → toggle (xóa)
    await reactionRepository.deleteReaction(userId, targetTypeUpper, targetId);
    reaction = null;
  } else {
    // Đã có khác loại → cập nhật
    reaction = await reactionRepository.updateReaction(
      userId,
      targetTypeUpper,
      targetId,
      reactionType
    );
  }

  return {
    success: true,
    reaction
  };
};

/**
 * Lấy danh sách reactions của một target
 * @param {Object} options - Các options
 * @param {number} options.targetId - ID của target
 * @param {string} options.targetType - Type của target
 * @returns {Promise<{success: boolean, reactions?: Array, message?: string, statusCode?: number}>}
 */
export const getReactionsService = async ({ targetId, targetType }) => {
  if (!targetId || !targetType) {
    return {
      success: false,
      message: "targetId và targetType là bắt buộc",
      statusCode: 400
    };
  }

  const reactions = await reactionRepository.findReactionsByTarget(
    targetId,
    targetType,
    {
      user: { select: userSelectFields }
    },
    {
      orderBy: { createdAt: 'desc' }
    }
  );

  return {
    success: true,
    reactions
  };
};

/**
 * Lấy reaction của current user cho một target
 * @param {Object} options - Các options
 * @param {number} options.userId - ID của user
 * @param {number} options.targetId - ID của target
 * @param {string} options.targetType - Type của target
 * @returns {Promise<{success: boolean, reaction?: Object, message?: string, statusCode?: number}>}
 */
export const getMyReactionService = async ({ userId, targetId, targetType }) => {
  if (!targetId || !targetType) {
    return {
      success: false,
      message: "targetId và targetType là bắt buộc",
      statusCode: 400
    };
  }

  const reaction = await reactionRepository.findReactionByUserAndTarget(
    userId,
    targetType,
    targetId
  );

  return {
    success: true,
    reaction
  };
};

/**
 * Lấy thống kê số lượng reactions theo từng type
 * @param {Object} options - Các options
 * @param {number} options.targetId - ID của target
 * @param {string} options.targetType - Type của target
 * @returns {Promise<{success: boolean, stats?: Object, total?: number, message?: string, statusCode?: number}>}
 */
export const getReactionStatsService = async ({ targetId, targetType }) => {
  if (!targetId || !targetType) {
    return {
      success: false,
      message: "targetId và targetType là bắt buộc",
      statusCode: 400
    };
  }

  // Group reactions by reactionType và đếm số lượng
  const stats = await reactionRepository.groupReactionsByType(targetId, targetType);

  // Chuyển đổi thành object dễ sử dụng: { LIKE: 5, LOVE: 3, ... }
  const statsMap = {};
  stats.forEach(stat => {
    statsMap[stat.reactionType] = stat._count.id;
  });

  // Tính tổng số reactions
  const total = stats.reduce((sum, stat) => sum + stat._count.id, 0);

  return {
    success: true,
    stats: statsMap,
    total
  };
};


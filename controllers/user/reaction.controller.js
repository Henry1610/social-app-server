import prisma from "../../utils/prisma.js";
import { createNotification } from "../../services/notificationService.js";

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
 * POST /api/user/reactions
 * Tạo, cập nhật hoặc xóa reaction (toggle nếu cùng loại)
 */
export const createOrUpdateReaction = async (req, res) => {
    const { targetId, targetType, type } = req.body;
    const userId = req.user.id;

    try {
        // Validate input
        if (!targetId || !targetType) {
            return res.status(400).json({ 
                success: false,
                message: "targetId và targetType là bắt buộc" 
            });
        }

        const reactionType = (type?.toUpperCase() || 'LIKE');
        if (!VALID_REACTION_TYPES.includes(reactionType)) {
            return res.status(400).json({ 
                success: false,
                message: `Reaction type không hợp lệ. Chỉ chấp nhận: ${VALID_REACTION_TYPES.join(', ')}` 
            });
        }

        const targetTypeUpper = targetType.toUpperCase();
        
        // Post và Repost chỉ hỗ trợ LIKE
        if ((targetTypeUpper === 'POST' || targetTypeUpper === 'REPOST') && reactionType !== 'LIKE') {
            return res.status(400).json({ 
                success: false,
                message: "Post và Repost chỉ hỗ trợ reaction type LIKE" 
            });
        }

        // Tìm reaction hiện tại
        const whereClause = {
                userId_targetType_targetId: {
                    userId: Number(userId),
                targetType: targetTypeUpper,
                    targetId: Number(targetId),
            }
        };

        const existingReaction = await prisma.reaction.findUnique({
            where: whereClause
        });

        let reaction = null;

        if (!existingReaction) {
            // Chưa có reaction → tạo mới
            reaction = await prisma.reaction.create({
                data: {
                    userId: Number(userId),
                    targetId: Number(targetId),
                    targetType: targetTypeUpper,
                    reactionType: reactionType,
                },
                include: {
                    user: { select: userSelectFields }
                }
            });

            // Tạo notification cho chủ sở hữu của target (nếu không phải chính họ react)
            try {
                let targetUserId = null;

                if (targetTypeUpper === "POST") {
                    const post = await prisma.post.findUnique({
                        where: { id: Number(targetId) },
                        select: { userId: true }
                    });
                    targetUserId = post?.userId;
                } else if (targetTypeUpper === "COMMENT") {
                    const comment = await prisma.comment.findUnique({
                        where: { id: Number(targetId) },
                        select: { userId: true }
                    });
                    targetUserId = comment?.userId;
                }

                if (targetUserId && targetUserId !== Number(userId)) {
                    await createNotification({
                        userId: targetUserId,
                        actorId: Number(userId),
                        type: "REACTION",
                        targetType: targetTypeUpper,
                        targetId: Number(targetId),
                    });
                }
            } catch (error) {
                console.error("Error creating notification in createOrUpdateReaction:", error);
            }
        } else if (existingReaction.reactionType === reactionType) {
            // Đã có cùng loại → toggle (xóa)
            await prisma.reaction.delete({ where: whereClause });
            reaction = null;
        } else {
            // Đã có khác loại → cập nhật
            reaction = await prisma.reaction.update({
                where: whereClause,
                data: { reactionType: reactionType },
            });
        }

        res.status(200).json({ success: true, reaction });
    } catch (error) {
        console.error("Error in createOrUpdateReaction:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error", 
            error: error.message 
        });
    }
};
/**
 * GET /api/user/reactions?targetId=123&targetType=POST
 * Lấy danh sách reactions của một target
 */
export const getReactions = async (req, res) => {
    const { targetId, targetType } = req.query;

    try {
        if (!targetId || !targetType) {
            return res.status(400).json({ 
                success: false,
                message: "targetId và targetType là bắt buộc" 
            });
        }

        const reactions = await prisma.reaction.findMany({
            where: { 
                targetId: Number(targetId), 
                targetType: targetType.toUpperCase() 
            },
            include: { 
                user: { select: userSelectFields }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json({ success: true, reactions });
    } catch (error) {
        console.error("Error in getReactions:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
};
/**
 * GET /api/user/reactions/me?targetId=123&targetType=POST
 * Lấy reaction của current user cho một target
 */
export const getMyReaction = async (req, res) => {
    const { targetId, targetType } = req.query;
    const userId = req.user.id;
    
    try {
        if (!targetId || !targetType) {
            return res.status(400).json({ 
                success: false,
                message: "targetId và targetType là bắt buộc" 
            });
        }

        const reaction = await prisma.reaction.findUnique({
            where: { 
                userId_targetType_targetId: { 
                    userId: Number(userId), 
                    targetType: targetType.toUpperCase(), 
                    targetId: Number(targetId) 
                } 
            }
        });
        
        res.status(200).json({ success: true, reaction });
    } catch (error) {
        console.error("Error in getMyReaction:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error", 
            error: error.message 
        });
    }
}

/**
 * GET /api/user/reactions/stats?targetId=123&targetType=COMMENT
 * Lấy thống kê số lượng reactions theo từng type
 */
export const getReactionStats = async (req, res) => {
    const { targetId, targetType } = req.query;
    
    try {
        if (!targetId || !targetType) {
            return res.status(400).json({ 
                success: false,
                message: "targetId và targetType là bắt buộc" 
            });
        }

        // Group reactions by reactionType và đếm số lượng
        const stats = await prisma.reaction.groupBy({
            by: ['reactionType'],
            where: {
                targetId: Number(targetId),
                targetType: targetType.toUpperCase()
            },
            _count: {
                id: true
            }
        });

        // Chuyển đổi thành object dễ sử dụng: { LIKE: 5, LOVE: 3, ... }
        const statsMap = {};
        stats.forEach(stat => {
            statsMap[stat.reactionType] = stat._count.id;
        });

        // Tính tổng số reactions
        const total = stats.reduce((sum, stat) => sum + stat._count.id, 0);

        res.status(200).json({ 
            success: true, 
            stats: statsMap,
            total
        });
    } catch (error) {
        console.error("Error in getReactionStats:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error", 
            error: error.message 
        });
    }
}
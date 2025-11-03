import prisma from "../../utils/prisma.js";
import { postEvents } from "../../socket/events/postEvents.js";

// POST /api/user/reactions
export const createOrUpdateReaction = async (req, res) => {
    const { targetId, targetType, type } = req.body;
    const userId = req.user.id;

    try {
        if (!targetId || !targetType) {
            return res.status(400).json({ message: "targetId và targetType là bắt buộc" });
        }

        const reactionType = type ? type.toUpperCase() : 'LIKE';
        const validReactionTypes = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];
        
        if (!validReactionTypes.includes(reactionType)) {
            return res.status(400).json({ message: `Reaction type không hợp lệ. Chỉ chấp nhận: ${validReactionTypes.join(', ')}` });
        }

        const targetTypeUpper = targetType.toUpperCase();
        
        if (targetTypeUpper === 'POST' && reactionType !== 'LIKE') {
            return res.status(400).json({ message: "Post chỉ hỗ trợ reaction type LIKE" });
        }

        let reaction = await prisma.reaction.findUnique({
            where: {
                userId_targetType_targetId: {
                    userId: Number(userId),
                    targetType: targetType.toUpperCase(),
                    targetId: Number(targetId),
                },
            },
        });

        if (!reaction) {
            // Chưa có reaction → tạo mới
            reaction = await prisma.reaction.create({
                data: {
                    userId: Number(userId),
                    targetId: Number(targetId),
                    targetType: targetType.toUpperCase(),
                    reactionType: reactionType,
                },
                include: {
                    user: {
                        select: { id: true, username: true, fullName: true, avatarUrl: true }
                    }
                }
            });

            // Emit event để tạo thông báo (event handler sẽ xử lý)
            postEvents.emit("reaction_created", {
                actor: {
                    id: reaction.user.id,
                    username: reaction.user.username,
                    fullName: reaction.user.fullName,
                    avatarUrl: reaction.user.avatarUrl
                },
                targetId: Number(targetId),
                targetType: targetTypeUpper
            });
        } else if (reaction.reactionType === reactionType) {
            // Đã có cùng loại → toggle (xóa)
            await prisma.reaction.delete({
                where: {
                    userId_targetType_targetId: {
                        userId: Number(userId),
                        targetType: targetType.toUpperCase(),
                        targetId: Number(targetId),
                    },
                },
            });
            reaction = null;
        } else {
            // Đã có khác loại → cập nhật
            reaction = await prisma.reaction.update({
                where: {
                    userId_targetType_targetId: {
                        userId: Number(userId),
                        targetType: targetType.toUpperCase(),
                        targetId: Number(targetId),
                    },
                },
                data: { reactionType: reactionType },
            });
        }

        res.status(200).json(reaction);
    } catch (error) {
        console.error("Error in createOrUpdateReaction:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
// DELETE  /api/user/reactions/:id
export const deleteReaction = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const reaction = await prisma.reaction.findUnique({ where: { id } });
        if (!reaction || reaction.userId !== userId) {
            return res.status(404).json({ message: "Reaction not found" });
        }
        await prisma.reaction.delete({ where: { id } });
        res.status(200).json({ message: "Reaction deleted" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
// POST /api/user/reactions?targetId=123&targetType=POST
export const getReactions = async (req, res) => {
    const { targetId, targetType } = req.query;

    try {
        const reactions = await prisma.reaction.findMany({
            where: { targetId: Number(targetId), targetType },
            include: { user: { select: { id: true, username: true } } },
        });

        return res.json({ success: true, reactions });
    } catch (err) {
        return res.status(500).json({ success: false, error: "Server error" });
    }
};
// GET /api/user/reactions/summary?targetId=123&targetType=POST
export const getReactionSummary = async (req, res) => {
    const { targetId, targetType } = req.query;
    try {
        const summary = await prisma.reaction.groupBy({
            by: ['reactionType'],
            where: { targetId: Number(targetId), targetType },
            _count: { reactionType: true },
        });
        res.status(200).json(summary);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
// GET /api/user/reactions/me?targetId=123&targetType=POST
export const getMyReaction = async (req, res) => {
    const { targetId, targetType } = req.query;
    const userId = req.user.id;
    try {
        if (!targetId || !targetType) {
            return res.status(400).json({ message: "targetId và targetType là bắt buộc" });
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
        res.status(200).json(reaction);
    } catch (error) {
        console.error("Error in getMyReaction:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}
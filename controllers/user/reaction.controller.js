import prisma from "../../utils/prisma.js";

// POST /api/user/reactions
export const createOrUpdateReaction = async (req, res) => {
    const { targetId, targetType, type } = req.body;
    const userId = req.user.id;

    try {
        let reaction = await prisma.reaction.findUnique({
            where: {
                userId_targetType_targetId: {
                    userId: Number(userId),
                    targetType,
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
                    targetType,
                    type,
                },
            });
        } else if (reaction.type === type) {
            // Đã có cùng loại → toggle (xóa)
            await prisma.reaction.delete({
                where: {
                    userId_targetType_targetId: {
                        userId: Number(userId),
                        targetType,
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
                        targetType,
                        targetId: Number(targetId),
                    },
                },
                data: { type },
            });
        }

        res.status(200).json(reaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
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
            by: ['type'],
            where: { targetId: Number(targetId), targetType },
            _count: { type: true },
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
        const reaction = await prisma.reaction.findUnique({
            where: { userId_targetId_targetType: { userId, targetId: Number(targetId), targetType } }
        });
        res.status(200).json(reaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
// server/routes/post.routes.js
import express from 'express';
import {
    createOrUpdateReaction,
    getReactions,
    getMyReaction,
    getReactionStats,
} from '../../controllers/user/reaction.controller.js';

const router = express.Router();
// Thả hoặc đổi reaction
router.post("/", createOrUpdateReaction);

// Lấy danh sách reaction của 1 target 
router.get("/", getReactions);

// Lấy reaction của user hiện tại cho 1 target
router.get("/me", getMyReaction);

// Lấy thống kê số lượng reactions theo từng type
router.get("/stats", getReactionStats);

export default router;

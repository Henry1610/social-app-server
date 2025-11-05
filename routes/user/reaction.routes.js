// server/routes/post.routes.js
import express from 'express';
import {
    createOrUpdateReaction,
    deleteReaction,
    getReactions,
    getMyReaction,
} from '../../controllers/user/reaction.controller.js';

const router = express.Router();
// Thả hoặc đổi reaction
router.post("/", createOrUpdateReaction);

// Xóa reaction của chính user trên 1 target
router.delete("/", deleteReaction);

// Lấy danh sách reaction của 1 target 
router.get("/", getReactions);

// Lấy reaction của user hiện tại cho 1 target
router.get("/me", getMyReaction);

export default router;

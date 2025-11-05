import express from 'express';
import { commentPost, getCommentsByPost, deleteComment, commentRepost, getCommentsByRepost } from '../../controllers/user/comment.controller.js';

const router = express.Router();

// Post comments
router.get('/posts/:id', getCommentsByPost);
router.post('/posts/:id', commentPost);
router.delete('/posts/:id', deleteComment);

// Repost comments
router.get('/reposts/:id', getCommentsByRepost);
router.post('/reposts/:id', commentRepost);
router.delete('/reposts/:id', deleteComment);

export default router;
import express from 'express';
import { commentPost, getCommentsByPost,editComment,deleteComment } from '../../controllers/user/comment.controller.js';

const router = express.Router();

router.get('/posts/:id', getCommentsByPost);
router.post('/posts/:id', commentPost);
router.patch('/posts/:id', editComment);
router.delete('/posts/:id', deleteComment);

export default router;
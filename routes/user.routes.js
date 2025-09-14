import express from 'express';
import PostRoutes from './user/post.routes.js'
import RepostRoutes from './user/repost.routes.js'
import CommentRoutes from './user/comment.routes.js'
const router = express.Router();

router.use('/posts', PostRoutes);
router.use('/reposts', RepostRoutes);
router.use('/comments', CommentRoutes);
export default router;

import express from 'express';
import PostRoutes from './user/post.routes.js'
import RepostRoutes from './user/repost.routes.js'
const router = express.Router();

router.use('/posts', PostRoutes);
router.use('/reposts', RepostRoutes);
export default router;

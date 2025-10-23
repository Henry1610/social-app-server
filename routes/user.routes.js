import express from 'express';
import PostRoutes from './user/post.routes.js'
import RepostRoutes from './user/repost.routes.js'
import CommentRoutes from './user/comment.routes.js'
import FollowRoutes from './user/follow.routes.js'
import ReactionRoutes from './user/reaction.routes.js'
import NotificationRoutes from './user/notification.routes.js'
import ChatRoutes from './user/chat.routes.js'
import SearchRoutes from './user/search.routes.js'
import ProfileRoutes from './user/profile.routes.js'

const router = express.Router();

router.use("/chat", ChatRoutes);
router.use('/posts', PostRoutes);
router.use('/reposts', RepostRoutes);
router.use('/comments', CommentRoutes);
router.use('/follows', FollowRoutes);
router.use('/reactions', ReactionRoutes);
router.use('/notifications', NotificationRoutes);
router.use('/search', SearchRoutes);
router.use('/', ProfileRoutes);

export default router;

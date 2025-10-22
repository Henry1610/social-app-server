import express from 'express';
import PostRoutes from './user/post.routes.js'
import RepostRoutes from './user/repost.routes.js'
import CommentRoutes from './user/comment.routes.js'
import FollowRoutes from './user/follow.routes.js'
import ReactionRoutes from './user/reaction.routes.js'
import NotificationRoutes from './user/notification.routes.js'
import { searchUsers, getPublicProfile, getMySearchHistory, clearMySearchHistory, recordSearchSelection, deleteSearchHistoryItem } from '../controllers/user/user.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { resolveUser } from '../middlewares/resolveUser.js'
const router = express.Router();

router.use('/posts', PostRoutes);
router.use('/reposts', RepostRoutes);
router.use('/comments', CommentRoutes);
router.use('/follows', FollowRoutes);
router.use('/reactions', ReactionRoutes);
router.use('/notifications', NotificationRoutes);
router.get('/search', searchUsers);
router.post('/search/selection', authenticate, recordSearchSelection);
router.get('/search/history', authenticate, getMySearchHistory);
router.delete('/search/history', authenticate, clearMySearchHistory);
router.delete('/search/history/:type/:id', authenticate, deleteSearchHistoryItem);
router.get('/:username/profile', resolveUser, getPublicProfile);

export default router;

import express from 'express';
import { repostPost, undoRepost, markRepostAsViewed } from '../../controllers/user/repost.controller.js';

const router = express.Router();
router.post('/:postId', repostPost);
router.delete('/:postId', undoRepost);
router.post('/:repostId/view', markRepostAsViewed);

export default router;
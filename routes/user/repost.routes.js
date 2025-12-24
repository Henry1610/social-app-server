import express from 'express';
import { repostPost, undoRepost, markRepostAsViewed, getRepostById } from '../../controllers/user/repost.controller.js';

const router = express.Router();

router.get('/:repostId', getRepostById);
router.post('/:postId', repostPost);
router.delete('/:postId', undoRepost);
router.post('/:repostId/view', markRepostAsViewed);

export default router;
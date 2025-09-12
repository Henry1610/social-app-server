import express from 'express';
import { getAllRePosts, repostPost, undoRepost } from '../../controllers/user/repost.controller.js';

const router = express.Router();

router.get('/', getAllRePosts);
router.post('/:id', repostPost);
router.delete('/:id', undoRepost);

export default router;
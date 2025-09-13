import express from 'express';
import { getAllMyReposts, repostPost, undoRepost } from '../../controllers/user/repost.controller.js';

const router = express.Router();

router.get('/', getAllMyReposts);
router.post('/:id', repostPost);
router.delete('/:id', undoRepost);

export default router;
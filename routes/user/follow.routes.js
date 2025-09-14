// server/routes/post.routes.js
import express from 'express';
import {
    followUser,
    unfollowUser,
    getMyFollowers,
    getMyFollowings
} from '../../controllers/user/follow.controller.js';

const router = express.Router();

router.post('/:id', followUser);
router.delete('/:id', unfollowUser);
router.get('/followers', getMyFollowers);
router.get('/following', getMyFollowings);

export default router;

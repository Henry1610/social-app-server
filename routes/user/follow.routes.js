// server/routes/post.routes.js
import express from 'express';
import {
    followUser,
    removeFollower,
    removeFollowing,
    getFollowings,
    getFollowers,
    getFollowStatus,
    getFollowStats,
    getMutualFollowers,
    getFollowSuggestions

} from '../../controllers/user/follow.controller.js';

const router = express.Router();

router.get('/:username/following', getFollowings);
router.get('/:username/follower', getFollowers);
router.post('/:username/follow', followUser);
router.delete('/:username/remove-following',removeFollowing);
router.delete('/:username/remove-follower', removeFollower);
router.post('/:username/status', getFollowStatus);
router.get('/:username/stats', getFollowStats);
router.get('/:username/mutual', getMutualFollowers);
router.get('/suggestions', getFollowSuggestions);

export default router;

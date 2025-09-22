// server/routes/post.routes.js
import express from 'express';
import {
    followUser,
    unfollowUser,
    getMyFollowings,
    getMyFollowers,
    getFollowings,
    getFollowers,
    getFollowStatus,
    getFollowStats,
    getMutualFollowers,
    getFollowSuggestions

} from '../../controllers/user/follow.controller.js';
import {resolveUser} from '../../middlewares/resolveUser.js';

const router = express.Router();

router.get('/following', getMyFollowings);
router.get('/follower', getMyFollowers);
router.post('/:username',resolveUser, followUser);
router.delete('/:username',resolveUser,unfollowUser);

router.get('/:username/following',resolveUser, getFollowings);
router.get('/:username/follower',resolveUser, getFollowers);


// router.delete('/:username/remove-follower', removeFollower);
// router.post('/:username/status', getFollowStatus);
// router.get('/:username/stats', getFollowStats);
// router.get('/:username/mutual', getMutualFollowers);
// router.get('/suggestions', getFollowSuggestions);

export default router;

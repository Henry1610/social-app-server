// server/routes/post.routes.js
import express from 'express';
import {
    followUser,
    unfollowUser,
    getMyFollowings,
    getMyFollowers,
    getFollowings,
    getFollowers,
    getFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest,
    

} from '../../controllers/user/follow.controller.js';
import { resolveUser } from '../../middlewares/resolveUser.js';

const router = express.Router();

router.get('/requests', getFollowRequests);
router.get('/followings', getMyFollowings);
router.get('/followers', getMyFollowers);
router.post('/:username', resolveUser, followUser);
router.delete('/:username', resolveUser, unfollowUser);
router.post('/requests/:requestId/accept', acceptFollowRequest);
router.delete('/requests/:requestId/reject', rejectFollowRequest);
router.delete('/:username/remove-follower', rejectFollowRequest);
router.get('/:username/following', resolveUser, getFollowings);
router.get('/:username/follower', resolveUser, getFollowers);

// router.post('/:username/status', getFollowStatus);
// router.get('/:username/stats', getFollowStats);
// router.get('/:username/mutual', getMutualFollowers);
// router.get('/suggestions', getFollowSuggestions);

export default router;

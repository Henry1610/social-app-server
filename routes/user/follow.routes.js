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
    removeFollower,
    getFollowSuggestions,
    getFollowStatus,
    getAlsoFollowing,
    getFollowStats,
    cancelFollowRequest

} from '../../controllers/user/follow.controller.js';
import { resolveUser } from '../../middlewares/resolveUser.js';

const router = express.Router();

router.get('/requests', getFollowRequests);
router.get('/followings', getMyFollowings);//cache 
router.get('/followers', getMyFollowers);//cache 
router.get('/suggestions', getFollowSuggestions);
router.post('/requests/:requestId/accept', acceptFollowRequest);
router.delete('/requests/:requestId/reject', rejectFollowRequest);
router.get('/also-following/:username',resolveUser, getAlsoFollowing); 
router.post('/:username', resolveUser, followUser);
router.get('/:username/stats',resolveUser, getFollowStats);//cache 
router.get('/:username/status',resolveUser, getFollowStatus);
router.delete('/:username', resolveUser, unfollowUser);
router.delete('/:username/remove-follower',resolveUser, removeFollower);
router.get('/:username/following', resolveUser, getFollowings);//cache 
router.get('/:username/follower', resolveUser, getFollowers);//cache 
router.delete('/:username/cancel-request', resolveUser, cancelFollowRequest);

export default router;

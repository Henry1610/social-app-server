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
    getFollowStats

} from '../../controllers/user/follow.controller.js';
import { resolveUser } from '../../middlewares/resolveUser.js';

const router = express.Router();

router.get('/requests', getFollowRequests);//realtime
router.get('/followings', getMyFollowings);//cache //realtime
router.get('/followers', getMyFollowers);//cache //realtime
router.get('/suggestions', getFollowSuggestions);//cache 
router.post('/requests/:requestId/accept', acceptFollowRequest);//realtime
router.delete('/requests/:requestId/reject', rejectFollowRequest);//realtime
router.get('/also-following/:username',resolveUser, getAlsoFollowing);//cache //realtime
router.post('/:username', resolveUser, followUser);//realtime
router.get('/:username/stats',resolveUser, getFollowStats);//cache //realtime
router.get('/:username/status',resolveUser, getFollowStatus);//realtime
router.delete('/:username', resolveUser, unfollowUser);//realtime
router.delete('/:username/remove-follower',resolveUser, removeFollower);//realtime
router.get('/:username/following', resolveUser, getFollowings);//cache //realtime
router.get('/:username/follower', resolveUser, getFollowers);//cache //realtime
export default router;
//thiếu gỡ yêu cầu theo dõi

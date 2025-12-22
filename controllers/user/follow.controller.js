import {
  followUserService,
  unfollowUserService,
  acceptFollowRequestService,
  rejectFollowRequestService,
  removeFollowerService,
  getFollowRequestsList,
  getFollowStatusService,
  getAlsoFollowingService,
  getFollowSuggestionsService,
  cancelFollowRequestService,
  getFollowingsWithValidation,
  getFollowersWithValidation,
  getFollowStatsWithValidation,
} from "../../services/followService.js";
import { getFollowersList, getFollowingList } from "../../services/redis/followService.js";

// POST api/user/follows/:username ( nếu là tk private thì tạo follow request)
export const followUser = async (req, res) => {
    const userId = req.user.id;
    const followingId = Number(req.resolvedUserId);

    try {
        const result = await followUserService(userId, followingId);
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    type: result.type,
                    targetUser: result.targetUser
                }
            });
        }

        res.status(400).json({ success: false, message: result.message });
    } catch (error) {
        console.error("Error in followUser controller:", error);
        res.status(500).json({ success: false, message: "Lỗi server!" });
    }
};

// DELETE api/user/follow/:username
export const unfollowUser = async (req, res) => {
    const id = req.resolvedUserId;
    const userId = req.user.id;

    try {
        const result = await unfollowUserService(userId, Number(id));
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in unfollowUser controller:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi hủy theo dõi người dùng!'
        });
    }
}

//GET /api/user/follow/requests
export const getFollowRequests = async (req, res) => {
    const userId = req.user.id;
    try {
        // Lấy danh sách follow requests bằng service
        const requests = await getFollowRequestsList(userId);

        res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('Error getting follow requests:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách yêu cầu theo dõi!'
        });
    }
}

//POST /api/user/follow/requests/:username/accept
export const acceptFollowRequest = async (req, res) => {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user.id;
    
    try {
        const result = await acceptFollowRequestService(currentUserId, targetUserId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        // Emit event để tạo notification
        res.json({
            success: true,
            message: "Bạn đã chấp nhận yêu cầu theo dõi.",
            data: result
        });
    } catch (error) {
        console.error('Error accepting follow request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi chấp nhận yêu cầu theo dõi!'
        });
    }
}

//DELETE /api/user/follow/requests/:username/reject
export const rejectFollowRequest = async (req, res) => {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user.id;
    
    try {
        const result = await rejectFollowRequestService(targetUserId, currentUserId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        // Emit event để tạo notification
        res.json(result);
    } catch (error) {
        console.error('Error rejecting follow request:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi từ chối yêu cầu theo dõi!'
        });
    }
}

//DELETE /api/user/follow/:username/remove-follower
export const removeFollower = async (req, res) => {
    const followerId = Number(req.resolvedUserId);
    const userId = req.user.id;
    try {
        const result = await removeFollowerService(followerId, userId);
        res.json(result);
    }
    catch (error) {
        console.error('Error removing follower:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa người theo dõi!'
        });
    }
}

// GET api/user/follow/followers
export const getMyFollowers = async (req, res) => {
    const userId = req.user.id;
    try {
        // Lấy danh sách followers
        const followers = await getFollowersList(userId);

        res.json({
            success: true,
            followers
        });
    } catch (error) {
        console.error('Error getting followers:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách người theo dõi!'

        });
    }
};

// GET api/user/follow/followings
export const getMyFollowings = async (req, res) => {
    const userId = req.user.id;
    try {
        // Lấy danh sách followings
        const followings = await getFollowingList(userId);
        res.json({
            success: true,
            followings
        });
    } catch (error) {
        console.error('Error getting followings:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách đang theo dõi!'

        });
    }
};

// GET api/user/follow/:username/followings
export const getFollowings = async (req, res) => {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user.id;

    try {
        const result = await getFollowingsWithValidation(currentUserId, targetUserId);
        
        if (!result.success) {
            const statusCode = result.message.includes('private') ? 403 : 404;
            return res.status(statusCode).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error getting followings:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách following!'
        });
    }
};

// GET api/user/follow/:username/followers
export const getFollowers = async (req, res) => {
    const targetUserId = Number(req.resolvedUserId);
    const currentUserId = req.user.id;

    try {
        const result = await getFollowersWithValidation(currentUserId, targetUserId);
        
        if (!result.success) {
            const statusCode = result.message.includes('private') ? 403 : 404;
            return res.status(statusCode).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error getting followers:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách followers!'
        });
    }
};

// GET /api/user/follow/:username/status
export const getFollowStatus = async (req, res) => {
    const id = req.resolvedUserId;
    const currentUserId = req.user.id;

    try {
        const result = await getFollowStatusService(currentUserId, id);
        
        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error getting follow status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi kiểm tra trạng thái follow!'
        });
    }
};

// GET /api/user/follow/:username/stats
export const getFollowStats = async (req, res) => {
    const id = req.resolvedUserId;

    try {
        const result = await getFollowStatsWithValidation(id);
        
        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error getting follow stats:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê follow!'
        });
    }
};

// GET /api/user/follow/also-following/:username
export const getAlsoFollowing = async (req, res) => {
    const id = req.resolvedUserId;
    const currentUserId = req.user.id;

    try {
        const result = await getAlsoFollowingService(currentUserId, id);
        
        if (!result.success) {
            const statusCode = result.message.includes('chính mình') ? 400 : 404;
            return res.status(statusCode).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error getting also following:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách also following!'
        });
    }
};

// GET /api/user/follow/suggestions
export const getFollowSuggestions = async (req, res) => {
    const currentUserId = req.user.id;
    const SUGGESTION_LIMIT = 10;

    try {
        // Lấy gợi ý follow bằng service
        const suggestions = await getFollowSuggestionsService(currentUserId, SUGGESTION_LIMIT);

        res.json({
            success: true,
            suggestions
        });
    } catch (error) {
        console.error('Error getting follow suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy gợi ý theo dõi!'
        });
    }
};

//DELETE /api/user/follow/:username/cancel-request
export const cancelFollowRequest = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.resolvedUserId;

        // Hủy follow request bằng service
        const result = await cancelFollowRequestService(currentUserId, targetUserId);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error("Lỗi khi hủy yêu cầu theo dõi:", error);
        return res.status(500).json({
            success: false,
            message: "Lỗi server khi hủy yêu cầu theo dõi.",
        });
    }
};
  
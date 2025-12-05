import {
  followUserService,
  unfollowUserService,
  acceptFollowRequestService,
  rejectFollowRequestService,
  removeFollowerService,
  getFollowRequestsList,
  findFollowRequest,
  canViewFollowList,
  getFollowStatusService,
  getAlsoFollowingService,
  getFollowSuggestionsService,
  cancelFollowRequestService,
} from "../../services/followService.js";
import { getFollowersList, getFollowingList, getFollowStatsService } from "../../services/redis/followService.js";
import prisma from "../../utils/prisma.js";
import { followEvents } from "../../socket/events/followEvents.js";
import { getUserById } from "../../services/userService.js";

// POST api/user/follows/:username ( nếu là tk private thì tạo follow request)
export const followUser = async (req, res) => {
    const userId = req.user.id;
    const followingId = Number(req.resolvedUserId);

    try {
        const result = await followUserService(userId, followingId);
        if (result.success) {
            const actor = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, username: true, fullName: true, avatarUrl: true }
            });
            if (result.type === "follow_request") {
                followEvents.emit("follow_request_sent", {
                    actor,
                    targetUserId: followingId
                });
            } else if (result.type === "follow") {
                followEvents.emit("follow_completed", {
                    actor,
                    targetUserId: followingId
                });
            }

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
        // Kiểm tra follow request tồn tại bằng service
        const existingRequest = await findFollowRequest(targetUserId, currentUserId);
        if (!existingRequest) {
            return res.status(404).json({
                success: false,
                message: "Yêu cầu theo dõi không tồn tại!"
            });
        }

        const result = await acceptFollowRequestService(currentUserId, targetUserId);
        
        // Emit event để tạo notification
        const actor = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { id: true, username: true, fullName: true, avatarUrl: true }
        });
        
        if (actor) {
            followEvents.emit("follow_request_accepted", {
                actor,
                targetUserId: targetUserId
            });
        }
        
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
        // Kiểm tra follow request tồn tại bằng service
        const existingRequest = await findFollowRequest(targetUserId, currentUserId);
        if (!existingRequest) {
            return res.status(404).json({
                success: false,
                message: "Yêu cầu theo dõi không tồn tại!"
            });
        }
        
        // Xử lý từ chối follow request
        const result = await rejectFollowRequestService(targetUserId, currentUserId);
        
        // Emit event để tạo notification
        const actor = await prisma.user.findUnique({
            where: { id: currentUserId },
            select: { id: true, username: true, fullName: true, avatarUrl: true }
        });
        
        if (actor) {
            followEvents.emit("follow_request_rejected", {
                actor,
                targetUserId: targetUserId
            });
        }
        
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
        // Tìm user theo username
        const user = await getUserById(targetUserId, 'User không tồn tại!');

        // Kiểm tra quyền xem following bằng service
        const hasPermission = await canViewFollowList(currentUserId, targetUserId, user);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản này là private. Bạn cần theo dõi để xem danh sách following!'
            });
        }

        // Lấy danh sách followings (những người mà user đang theo dõi)
        const followings = await getFollowingList(targetUserId);

        res.json({
            success: true,
            followings
        });
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
        // Tìm user theo username
        const user = await getUserById(targetUserId, 'User không tồn tại!');

        // Kiểm tra quyền xem followers bằng service
        const hasPermission = await canViewFollowList(currentUserId, targetUserId, user);
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản này là private. Bạn cần theo dõi để xem danh sách followers!'
            });
        }

        // Lấy danh sách followers (những người đang theo dõi user này)
        const followers = await getFollowersList(targetUserId);

        res.json({
            success: true,
            followers
        });
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
        // Tìm user theo username
        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }

        // Lấy follow status bằng service
        const status = await getFollowStatusService(currentUserId, id);

        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }

        res.json({
            success: true,
            ...status
        });
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
        // Tìm user theo username
        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }

        // Đếm số followers và followings
        const stats = await getFollowStatsService(id);

        res.json({
            success: true,
            stats
        });
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
        // Lấy user theo username
        const user = await prisma.user.findUnique({
            where: { id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }

        if (user.id === currentUserId) {
            return res.status(400).json({
                success: false,
                message: 'Không thể kiểm tra với chính mình!'
            });
        }

        // Lấy danh sách người bạn follow cũng follow target bằng service
        const alsoFollowing = await getAlsoFollowingService(currentUserId, user.id);

        res.json({
            success: true,
            alsoFollowing
        });
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
  
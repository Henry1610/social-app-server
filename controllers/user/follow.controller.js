import { followUserService, unfollowUserService } from "../../services/followService.js";
import { getFollowersList, getFollowingList } from "../../services/redis/followService.js";

// POST api/user/follow/:id
export const followUser = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const result = await followUserService(userId, Number(id));
        
        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error in followUser controller:', error);
        res.status(500).json({ success: false, message: "Lỗi server!" });
    }
};

// DELETE api/user/follow/:id
export const unfollowUser = async (req, res) => {
    const { id } = req.params;
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
}

// GET api/user/follow/following
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
}
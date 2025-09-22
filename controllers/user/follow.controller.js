import { followUserService, unfollowUserService } from "../../services/followService.js";
import { getFollowersList, getFollowingList } from "../../services/redis/followService.js";
import prisma from "../../utils/prisma.js";
// POST api/user/follows/:username
export const followUser = async (req, res) => {
    const id  = req.resolvedUserId;
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

// DELETE api/user/follow/:username
export const unfollowUser = async (req, res) => {
    const id  = req.resolvedUserId;
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
};

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
};

// GET api/user/follow/:username/followings
export const getFollowings = async (req, res) => {
    const { username } = req.params;
    const currentUserId = req.user.id;

    try {
        // Tìm user theo username
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                privacySettings: {
                    select: { isPrivate: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }

        // Nếu tài khoản private và không phải chính chủ → chặn
        if (user.privacySetting?.isPrivate && user.id !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản này là private. Bạn không thể xem danh sách following!'
            });
        }

        // Lấy danh sách followings (những người mà user đang theo dõi)
        const followings = await prisma.follow.findMany({
            where: { followerId: user.id },
            select: {
                following: {
                    select: { id: true, username: true, fullName: true, avatarUrl: true }
                },
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            followings: followings.map(f => f.following)
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
    const { username } = req.params;
    const currentUserId = req.user.id;
    
    try {
        // Tìm user theo username
        const user = await prisma.user.findUnique({
            where: { username },
            select: {
                id: true,
                privacySettings: {
                    select: { isPrivate: true }
                }
            }
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }
        
        // Nếu tài khoản private và không phải chính chủ → chặn
        if (user.privacySetting?.isPrivate && user.id !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản này là private. Bạn không thể xem danh sách followers!'
            });
        }

        // Lấy danh sách followers (những người đang theo dõi user này)
        const followers = await prisma.follow.findMany({
            where: { followingId: user.id }, // Đây là điểm khác biệt chính
            select: {
                follower: { // Và đây cũng vậy
                    select: { id: true, username: true, fullName: true, avatarUrl: true }
                },
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            followers: followers.map(f => f.follower)
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
    const { username } = req.params;
    const currentUserId = req.user.id;

    try {
        // Tìm user theo username
        const user = await prisma.user.findUnique({
            where: { username },
            select: { id: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }

        if (user.id === currentUserId) {
            return res.json({
                success: true,
                isFollowing: false,
                isSelf: true
            });
        }

        // Kiểm tra trạng thái follow
        const follow = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUserId,
                    followingId: user.id
                }
            },
            select: { followerId: true, followingId: true }
        });

        res.json({
            success: true,
            isFollowing: !!follow,
            isSelf: false
        });
    }   catch (error) {       
        console.error('Error getting follow status:', error);   
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi kiểm tra trạng thái follow!'
        });
    }
};

// GET /api/user/follow/:username/stats
export const getFollowStats = async (req, res) => {
    const { username } = req.params;

    try {
        // Tìm user theo username
        const user = await prisma.user.findUnique({
            where: { username },
            select: { id: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại!'
            });
        }

        // Đếm số followers và followings
        const [followersCount, followingsCount] = await Promise.all([
            prisma.follow.count({ where: { followingId: user.id } }),
            prisma.follow.count({ where: { followerId: user.id } })
        ]);

        res.json({
            success: true,
            followersCount,
            followingsCount
        });
    } catch (error) {
        console.error('Error getting follow stats:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê follow!'
        });
    }
};

// GET /api/user/follow/:username/mutual
export const getMutualFollowers = async (req, res) => {
    const { username } = req.params;
    const currentUserId = req.user.id;

    try {
        // Tìm user theo username
        const user = await prisma.user.findUnique({
            where: { username },
            select: { id: true }
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
                message: 'Không thể lấy bạn bè chung với chính mình!'
            });
        }

        // Lấy danh sách followers của user
        const userFollowers = await prisma.follow.findMany({
            where: { followingId: user.id },
            select: { followerId: true }
        });
        const userFollowerIds = userFollowers.map(f => f.followerId);

        if (userFollowerIds.length === 0) {
            return res.json({
                success: true,
                mutualFollowers: []
            });
        }

        // Tìm những người trong danh sách followers của user mà currentUser cũng đang follow
        const mutualFollowers = await prisma.follow.findMany({
            where: {
                followerId: currentUserId,
                followingId: { in: userFollowerIds }
            },
            select: {
                following: {
                    select: { id: true, username: true, fullName: true, avatarUrl: true }
                }
            }
        });

        res.json({
            success: true,
            mutualFollowers: mutualFollowers.map(f => f.following)
        });
    } catch (error) {
        console.error('Error getting mutual followers:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy bạn bè chung!'
        });
    }
};

// GET /api/user/follow/suggestions
export const getFollowSuggestions = async (req, res) => {
    const currentUserId = req.user.id;
    const SUGGESTION_LIMIT = 10;

    try {
        // Lấy danh sách những người mà currentUser đang follow
        const currentUserFollowings = await prisma.follow.findMany({
            where: { followerId: currentUserId },
            select: { followingId: true }
        });
        const followingIds = currentUserFollowings.map(f => f.followingId);

        // Tìm những người được follow bởi những người mà currentUser đang follow (2nd degree connections)
        const suggestions = await prisma.follow.findMany({
            where: {
                followerId: { in: followingIds },
                followingId: { notIn: [...followingIds, currentUserId] } // Loại bỏ những người đã follow và chính mình
            },
            select: {
                following: {
                    select: { id: true, username: true, fullName: true, avatarUrl: true }
                }
            },
            distinct: ['followingId'], // Đảm bảo không có trùng lặp
            take: SUGGESTION_LIMIT
        });

        res.json({
            success: true,
            suggestions: suggestions.map(s => s.following)
        });
    } catch (error) {
        console.error('Error getting follow suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy gợi ý theo dõi!'
        });
    }
};
import { followUserService, unfollowUserService, acceptFollowRequestService, rejectFollowRequestService, removeFollowerService } from "../../services/followService.js";
import { getFollowersList, getFollowingList, getFollowStatsService } from "../../services/redis/followService.js";
import prisma from "../../utils/prisma.js";
import { followEvents } from "../../socket/events/followEvents.js";

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
        // Lấy danh sách follow requests
        const requests = await prisma.followRequest.findMany({
            where: { toUserId: userId },
            select: {
                id: true,
                fromUser: {
                    select: { id: true, username: true, fullName: true, avatarUrl: true }
                },
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

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
    const existingRequestId = await prisma.followRequest.findUnique({
        where: { fromUserId_toUserId: {
            fromUserId: targetUserId,
            toUserId: req.user.id
        } },
        select: { id: true }
    });
    if(!existingRequestId){
        return res.status(404).json({
            success: false,
            message: "Yêu cầu theo dõi không tồn tại!"
        });
    }
    try {
        const result = await acceptFollowRequestService(
            currentUserId,
            targetUserId
        );
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
        // Kiểm tra xem có follow request không
        const existingRequestId = await prisma.followRequest.findUnique({
            where: { 
                fromUserId_toUserId: {
                    fromUserId: targetUserId,
                    toUserId: currentUserId
                } 
            },
            select: { id: true }
        });
        
        if(!existingRequestId){
            return res.status(404).json({
                success: false,
                message: "Yêu cầu theo dõi không tồn tại!"
            });
        }
        
        // Xử lý từ chối follow request
        const result = await rejectFollowRequestService(
            targetUserId,//targetUserId là user được từ chối
            currentUserId);
        res.json(result);
    }
    catch (error) {
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
        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
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

        // Kiểm tra quyền xem following
        if (user.id !== currentUserId) {
            // Kiểm tra xem current user có đang follow target user không
            const isFollowing = await prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: currentUserId,
                        followingId: targetUserId
                    }
                }
            });

            // Nếu tài khoản private và current user không follow target user → chặn
            if (user.privacySettings?.isPrivate && !isFollowing) {
                return res.status(403).json({
                    success: false,
                    message: 'Tài khoản này là private. Bạn cần theo dõi để xem danh sách following!'
                });
            }
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
        const user = await prisma.user.findUnique({
            where: {
                id: targetUserId
            },
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

        // Kiểm tra quyền xem followers
        if (user.id !== currentUserId) {
            // Kiểm tra xem current user có đang follow target user không
            const isFollowing = await prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: currentUserId,
                        followingId: targetUserId
                    }
                }
            });

            // Nếu tài khoản private và current user không follow target user → chặn
            if (user.privacySettings?.isPrivate && !isFollowing) {
                return res.status(403).json({
                    success: false,
                    message: 'Tài khoản này là private. Bạn cần theo dõi để xem danh sách followers!'
                });
            }
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

        if (user.id === currentUserId) {
            // Nếu đang xem profile của chính mình, kiểm tra xem có follow requests đến không
            const incomingFollowRequests = await prisma.followRequest.findMany({
                where: {
                    toUserId: currentUserId
                },
                include: {
                    fromUser: {
                        select: {
                            id: true,
                            username: true,
                            fullName: true,
                            avatarUrl: true
                        }
                    }
                }
            });
            
            return res.json({
                success: true,
                isFollowing: false,
                isSelf: true,
                incomingRequests: incomingFollowRequests
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
        
        // Kiểm tra xem user đang xem có đang theo dõi user hiện tại không
        const isFollower = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: user.id,
                    followingId: currentUserId
                }
            }
        });
        
        const followRequest = await prisma.followRequest.findUnique({
            where: {
                fromUserId_toUserId: {
                    fromUserId: currentUserId,
                    toUserId: user.id,
                },
            },
        });
        
        // Kiểm tra xem user đang xem có gửi follow request đến user hiện tại không
        const incomingFollowRequest = await prisma.followRequest.findUnique({
            where: {
                fromUserId_toUserId: {
                    fromUserId: user.id,
                    toUserId: currentUserId,
                },
            },
        });
        
        res.json({
            success: true,
            isSelf: false,
            isPrivate: user.isPrivate,
            isFollowing: !!follow,
            isPending: !!followRequest,
            isFollower: !!isFollower,
            hasIncomingRequest: !!incomingFollowRequest
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
        // 1. Lấy user theo username
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

        // 2. Lấy danh sách người currentUser đang follow
        const myFollowings = await prisma.follow.findMany({
            where: { followerId: currentUserId },
            select: { followingId: true }
        });
        const myFollowingIds = myFollowings.map(f => f.followingId);

        if (myFollowingIds.length === 0) {
            return res.json({
                success: true,
                alsoFollowing: []
            });
        }

        // 3. Lấy danh sách followers của target user
        const targetFollowers = await prisma.follow.findMany({
            where: { followingId: user.id, followerId: { in: myFollowingIds } },
            select: {
                follower: {
                    select: { id: true, username: true, fullName: true, avatarUrl: true }
                }
            }
        });

        // 4. Trả về danh sách người bạn follow cũng follow target
        res.json({
            success: true,
            alsoFollowing: targetFollowers.map(f => f.follower)
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

//DELETE /api/user/follow/:username/cancel-request
export const cancelFollowRequest = async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const targetUserId = req.resolvedUserId;
  
      // Kiểm tra xem có request nào tồn tại không
      const existingRequest = await prisma.followRequest.findUnique({
        where: {
          fromUserId_toUserId: {
            fromUserId: currentUserId,
            toUserId: targetUserId,
          },
        },
      });
  
      if (!existingRequest) {
        return res.status(404).json({
          success: false,
          message: "Không có yêu cầu theo dõi nào để hủy.",
        });
      }
  
      // Xóa request
      await prisma.followRequest.delete({
        where: { id: existingRequest.id },
      });
  
      return res.json({
        success: true,
        message: "Đã hủy yêu cầu theo dõi.",
      });
    } catch (error) {
      console.error("Lỗi khi hủy yêu cầu theo dõi:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi hủy yêu cầu theo dõi.",
      });
    }
  };
  
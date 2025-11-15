import { isFollowing } from "./followService.js";

/**
 * Kiểm tra quyền comment dựa trên whoCanComment setting
 * @param {number} userId - ID của user đang cố comment
 * @param {object} post - Post object có userId và whoCanComment
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
export const checkCommentPermission = async (userId, post) => {
  const whoCanComment = post.whoCanComment || 'everyone';
  
  switch (whoCanComment) {
    case "everyone":
      return { allowed: true };
      
    case "followers":
      const isFollower = await isFollowing(userId, post.userId);
      if (!isFollower) {
        return { allowed: false, message: "Chỉ follower mới được comment" };
      }
      return { allowed: true };
      
    case "nobody":
      if (post.userId !== userId) {
        return { allowed: false, message: "Chỉ chủ post mới được comment" };
      }
      return { allowed: true };
      
    default:
      return { allowed: false, message: "Cấu hình quyền comment không hợp lệ" };
  }
};


import {
  getUserNotifications
} from "../../services/notificationService.js";

// GET /api/user/notifications
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const result = await getUserNotifications(userId, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông báo!'
    });
  }
};
 
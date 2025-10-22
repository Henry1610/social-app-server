import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getUnreadNotificationCount 
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

// PUT /api/user/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const success = await markNotificationAsRead(parseInt(id), userId);

    if (success) {
      res.json({
        success: true,
        message: 'Đã đánh dấu thông báo đã đọc!'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo!'
      });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu thông báo!'
    });
  }
};

// PUT /api/user/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await markAllNotificationsAsRead(userId);

    res.json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo đã đọc!'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu tất cả thông báo!'
    });
  }
};

// GET /api/user/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await getUnreadNotificationCount(userId);

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy số lượng thông báo chưa đọc!'
    });
  }
};
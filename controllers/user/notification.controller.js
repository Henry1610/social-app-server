import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getUnreadNotificationCount 
} from '../../services/notificationService.js';

// Lấy danh sách thông báo của user
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 20 } = req.query;

    const result = await getUserNotifications(userId, parseInt(page), parseInt(limit));

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông báo',
      error: error.message
    });
  }
};

// Lấy số lượng thông báo chưa đọc
export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.user;

    const count = await getUnreadNotificationCount(userId);

    res.status(200).json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy số lượng thông báo chưa đọc',
      error: error.message
    });
  }
};

// Đánh dấu thông báo đã đọc
export const markAsRead = async (req, res) => {
  try {
    const { userId } = req.user;
    const { notificationId } = req.params;

    const success = await markNotificationAsRead(notificationId, userId);

    if (success) {
      res.status(200).json({
        success: true,
        message: 'Đã đánh dấu thông báo đã đọc'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo'
      });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đánh dấu thông báo đã đọc',
      error: error.message
    });
  }
};

// Đánh dấu tất cả thông báo đã đọc
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.user;

    await markAllNotificationsAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo đã đọc'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đánh dấu tất cả thông báo đã đọc',
      error: error.message
    });
  }
};

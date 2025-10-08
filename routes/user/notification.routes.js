import express from 'express';
import { 
  getNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead 
} from '../../controllers/user/notification.controller.js';

const router = express.Router();

// GET /api/notifications - Lấy danh sách thông báo
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Lấy số lượng thông báo chưa đọc
router.get('/unread-count', getUnreadCount);

// PUT /api/notifications/:notificationId/read - Đánh dấu thông báo đã đọc
router.put('/:notificationId/read', markAsRead);

// PUT /api/notifications/mark-all-read - Đánh dấu tất cả thông báo đã đọc
router.put('/mark-all-read', markAllAsRead);

export default router;

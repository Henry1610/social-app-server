import express from 'express';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  getUnreadCount 
} from '../../controllers/user/notification.controller.js';

const router = express.Router();


// GET /api/user/notifications
router.get('/', getNotifications);

// PUT /api/user/notifications/:id/read
router.put('/:id/read', markAsRead);

// PUT /api/user/notifications/read-all
router.put('/read-all', markAllAsRead);

// GET /api/user/notifications/unread-count
router.get('/unread-count', getUnreadCount);

export default router;
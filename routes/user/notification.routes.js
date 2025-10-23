import express from 'express';
import { getNotifications } from '../../controllers/user/notification.controller.js';

const router = express.Router();

// GET /api/user/notifications
router.get('/', getNotifications);

export default router;
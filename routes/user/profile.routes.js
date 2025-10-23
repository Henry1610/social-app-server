import express from 'express';
import { getPublicProfile } from '../../controllers/user/search.controller.js';
import { resolveUser } from '../../middlewares/resolveUser.js';

const router = express.Router();

// Profile routes
router.get('/:username/profile', resolveUser, getPublicProfile);

export default router;

import express from 'express';
import { getPublicProfile } from '../../controllers/user/search.controller.js';
import { uploadAvatar } from '../../controllers/user/upload.controller.js';
import { getUserPostsPreview } from '../../controllers/user/post.controller.js';
import { resolveUser } from '../../middlewares/resolveUser.js';
import { upload } from '../../middlewares/upload.js';

const router = express.Router();

router.get('/:username/profile', resolveUser, getPublicProfile);
router.get('/:username/posts', resolveUser, getUserPostsPreview);
router.post('/avatar', (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File vượt quá kích thước cho phép' })
      if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ success: false, message: 'Định dạng không hợp lệ' })
      return res.status(400).json({ success: false, message: 'Upload thất bại' })
    }
    next()
  })
}, uploadAvatar);

export default router;

// server/routes/post.routes.js
import express from 'express';
import {
  createPost,
  getAllMyPosts,
  getMyPostById,
  updatePost,
  deletePost,
  savePost,
  unsavePost,
  getMySavedPosts
} from '../../controllers/user/post.controller.js';
import { uploadPostMedia } from '../../controllers/user/upload.controller.js';
import { upload } from '../../middlewares/upload.js';
import { authenticate } from '../../middlewares/auth.js';

const router = express.Router();

router.post('/', createPost);
router.post('/upload-media', authenticate, (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File vượt quá kích thước cho phép' })
      if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ success: false, message: 'Định dạng không hợp lệ' })
      return res.status(400).json({ success: false, message: 'Upload thất bại' })
    }
    next()
  })
}, uploadPostMedia);
router.get('/', getAllMyPosts);
router.get('/saved-posts', getMySavedPosts);
router.get('/:id', getMyPostById);
router.patch('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/save', savePost);
router.delete('/:id/save', unsavePost);
export default router;

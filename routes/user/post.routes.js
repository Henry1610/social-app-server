// server/routes/post.routes.js
import express from 'express';
import {
  createPost,
  getMyPostById,
  updatePost,
  deletePost,
  savePost,
  unsavePost,
  markPostAsViewed,
  getFeedPosts
} from '../../controllers/user/post.controller.js';
import { uploadPostMedia } from '../../controllers/user/upload.controller.js';
import { upload } from '../../middlewares/upload.js';

const router = express.Router();

router.get('/feed', getFeedPosts);
router.post('/', createPost);
router.post('/upload-media', (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File vượt quá kích thước cho phép' })
      if (err.message === 'INVALID_FILE_TYPE') return res.status(400).json({ success: false, message: 'Định dạng không hợp lệ' })
      return res.status(400).json({ success: false, message: 'Upload thất bại' })
    }
    next()
  })
}, uploadPostMedia);
router.get('/:postId', getMyPostById);
router.put('/:postId', updatePost);
router.patch('/:postId', updatePost);
router.delete('/:postId', deletePost);
router.post('/:postId/save', savePost);
router.delete('/:postId/save', unsavePost);
router.post('/:postId/view', markPostAsViewed);
export default router;

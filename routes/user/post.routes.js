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

const router = express.Router();

router.post('/', createPost);
router.get('/', getAllMyPosts);
router.get('/saved-posts', getMySavedPosts);
router.get('/:id', getMyPostById);
router.patch('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/save', savePost);
router.delete('/:id/save', unsavePost);
export default router;

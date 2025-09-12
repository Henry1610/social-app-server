// server/routes/post.routes.js
import express from 'express';
import {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  savePost,
  unsavePost,
  getSavedPosts
} from '../../controllers/user/post.controller.js';

const router = express.Router();

router.post('/', createPost);
router.get('/', getAllPosts);
router.get('/:id', getPostById);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/save', savePost);
router.delete('/:id/save', unsavePost);
router.get('/save-posts', getSavedPosts);
export default router;

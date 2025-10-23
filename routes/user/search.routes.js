import express from 'express';
import {
  searchUsers,
  recordSearchSelection,
  getMySearchHistory,
  clearMySearchHistory,
  deleteSearchHistoryItem
} from '../../controllers/user/search.controller.js';

const router = express.Router();

// Search routes
router.get('/', searchUsers);
router.post('/selection', recordSearchSelection);
router.get('/history', getMySearchHistory);
router.delete('/history', clearMySearchHistory);
router.delete('/history/:type/:id', deleteSearchHistoryItem);

export default router;

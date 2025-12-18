import express from 'express';
import {
  getConversations,
  createConversation,
  getConversation,
  getConversationMembers,
  addMember,
  removeMember,
} from '../../controllers/user/conversation.controller.js';

import {
  getMessages,
  deleteMessage,
  getMessageStates,
  getMessageEditHistory,
  togglePinMessage,
  getPinnedMessages,
} from '../../controllers/user/message.controller.js';
import { uploadChatMedia } from '../../controllers/user/upload.controller.js';
import { uploadChat } from '../../middlewares/upload.js';

const router = express.Router();

// Conversation routes
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId', getConversation);
router.get('/conversations/:conversationId/members', getConversationMembers);
router.post('/conversations/:conversationId/members', addMember);
router.delete('/conversations/:conversationId/members/:userId', removeMember);

// Message routes
router.get('/conversations/:conversationId/messages', getMessages);
router.delete('/messages/:messageId', deleteMessage);
router.post('/uploads', (req, res, next) => {
  uploadChat.array('files', 10)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File vượt quá kích thước cho phép' })
      return res.status(400).json({ success: false, message: 'Upload thất bại' })
    }
    next()
  })
}, uploadChatMedia);

// Message state routes
router.get('/messages/:messageId/states', getMessageStates);

// Message edit history routes
router.get('/messages/:messageId/edit-history', getMessageEditHistory);

// Pinned message routes
router.post('/messages/:messageId/pin', togglePinMessage);
router.get('/conversations/:conversationId/pinned-messages', getPinnedMessages);


export default router;

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
  editMessage,
  deleteMessage,
  getMessageStates,
  toggleMessageReaction,
  getMessageReactions,
  getMessageEditHistory,
  togglePinMessage,
  getPinnedMessages,
} from '../../controllers/user/message.controller.js';

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
router.put('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);

// Message state routes
router.get('/messages/:messageId/states', getMessageStates);

// Message reaction routes
router.post('/messages/:messageId/reactions', toggleMessageReaction);
router.get('/messages/:messageId/reactions', getMessageReactions);

// Message edit history routes
router.get('/messages/:messageId/edit-history', getMessageEditHistory);

// Pinned message routes
router.post('/messages/:messageId/pin', togglePinMessage);
router.get('/conversations/:conversationId/pinned-messages', getPinnedMessages);


export default router;

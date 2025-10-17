// routes/messages.js
const express = require('express');
const router = express.Router();
const { ensureRole } = require('../middleware/roles');
const messageController = require('../controllers/messageController');

// inbox for authenticated users
router.get('/', ensureRole(['user','owner','admin','staff']), messageController.inbox);

// view conversation
router.get('/:id', ensureRole(['user','owner','admin','staff']), messageController.viewConversation);

// create new conversation + first message
router.post('/', ensureRole(['user','owner','admin','staff']), messageController.createConversation);

// post message into existing conversation
router.post('/:id', ensureRole(['user','owner','admin','staff']), messageController.postMessage);

module.exports = router;

// controllers/messageController.js
const messageModel = require('../models/messageModel');

exports.inbox = async (req, res) => {
  try {
    const convs = await messageModel.getConversationsForUser(req.user.id);
    return res.render('messages/index', { conversations: convs, user: req.user });
  } catch (err) {
    console.error('inbox error', err);
    req.flash('error', 'Unable to load messages');
    return res.redirect('/');
  }
};

exports.viewConversation = async (req, res) => {
  try {
    const convId = parseInt(req.params.id, 10);
    const messages = await messageModel.getMessagesForConversation(convId);
    return res.render('messages/thread', { messages, conversationId: convId, user: req.user });
  } catch (err) {
    console.error('viewConversation error', err);
    req.flash('error', 'Unable to load conversation');
    return res.redirect('/messages');
  }
};

// POST /messages -> create conversation + first message
exports.createConversation = async (req, res) => {
  try {
    const { subject, to_user_id, body } = req.body;
    // members: sender + recipient(s)
    const members = [req.user.id];
    if (to_user_id) members.push(parseInt(to_user_id,10));
    const conv = await messageModel.createConversation({ subject, memberIds: members });
    await messageModel.addMessage({ conversation_id: conv.id, sender_id: req.user.id, body });
    return res.redirect(`/messages/${conv.id}`);
  } catch (err) {
    console.error('createConversation error', err);
    req.flash('error', 'Unable to send message');
    return res.redirect('/messages');
  }
};

// POST /messages/:id -> send message in existing conversation
exports.postMessage = async (req, res) => {
  try {
    const convId = parseInt(req.params.id, 10);
    const { body } = req.body;
    await messageModel.addMessage({ conversation_id: convId, sender_id: req.user.id, body });
    return res.redirect(`/messages/${convId}`);
  } catch (err) {
    console.error('postMessage error', err);
    req.flash('error', 'Unable to send message');
    return res.redirect('/messages');
  }
};

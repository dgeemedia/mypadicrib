// models/messageModel.js
const db = require('./db');

async function createConversation({ subject, memberIds = [] }) {
  const conv = await db.one('INSERT INTO conversations(subject, created_at, last_message_at) VALUES($1, now(), now()) RETURNING id', [subject]);
  const convId = conv.id;
  const tasks = memberIds.map(uid => db.none('INSERT INTO conversation_members(conversation_id, user_id) VALUES($1,$2)', [convId, uid]));
  await Promise.all(tasks);
  return conv;
}

async function addMessage({ conversation_id, sender_id, body }) {
  const msg = await db.one('INSERT INTO messages(conversation_id, sender_id, body, created_at) VALUES($1,$2,$3,now()) RETURNING id, created_at', [conversation_id, sender_id, body]);
  await db.none('UPDATE conversations SET last_message_at = now() WHERE id=$1', [conversation_id]);
  return msg;
}

async function getConversationsForUser(userId) {
  const convs = await db.manyOrNone(
    `SELECT c.* FROM conversations c
     JOIN conversation_members cm ON cm.conversation_id = c.id
     WHERE cm.user_id = $1
     ORDER BY c.last_message_at DESC`, [userId]
  );
  return convs;
}

async function getMessagesForConversation(conversationId) {
  return db.manyOrNone('SELECT m.*, u.name AS sender_name FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.conversation_id=$1 ORDER BY m.created_at ASC', [conversationId]);
}

async function addMember(conversationId, userId) {
  return db.none('INSERT INTO conversation_members(conversation_id, user_id) VALUES($1,$2)', [conversationId, userId]);
}

async function markMessageRead(messageId, userId) {
  // append userId to read_by JSONB if not present
  return db.none(`UPDATE messages
                  SET read_by = CASE WHEN read_by ? $2 THEN read_by ELSE (read_by::jsonb || to_jsonb($2::int)) END
                  WHERE id = $1`, [messageId, userId]);
}

module.exports = {
  createConversation,
  addMessage,
  getConversationsForUser,
  getMessagesForConversation,
  addMember,
  markMessageRead
};

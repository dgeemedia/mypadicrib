// scripts/notify-owners.js
require('dotenv').config();

const db = require('../models/db');
const messageModel = require('../models/messageModel');

async function notify(listingId, adminId) {
  const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [listingId]);
  if (!listing) return console.log('no listing', listingId);
  let convId = null;
  const row = await db.oneOrNone("SELECT c.id FROM conversations c WHERE c.subject ILIKE $1 LIMIT 1", [`%Verification for listing #${listingId}%`]);
  if (row) convId = row.id;
  if (convId) {
    await messageModel.addMessage({
      conversation_id: convId,
      sender_id: adminId,
      body: `Your listing "${listing.title}" has been approved and is now live.`
    });
    console.log('Appended message to conv', convId);
  } else {
    const conv = await messageModel.createConversation({
      subject: `Listing #${listingId} approved`,
      memberIds: [listing.owner_id, adminId]
    });
    await messageModel.addMessage({
      conversation_id: conv.id,
      sender_id: adminId,
      body: `Your listing "${listing.title}" has been approved and is now live.`
    });
    console.log('Created conv and message', conv.id);
  }
}

(async () => {
  const ADMIN_ID = 1; // change to your admin id
  const listingIds = [/* array of listing ids to notify */];
  for (let id of listingIds) {
    try { await notify(id, ADMIN_ID); } catch (e) { console.error(e); }
  }
  process.exit(0);
})();

// jobs/expireListings.js
const cron = require('node-cron');
const db = require('../models/db');
const listingModel = require('../models/listingModel');
const messageModel = require('../models/messageModel');

// run every 15 minutes (adjust as needed)
cron.schedule('*/15 * * * *', async () => {
  try {
    // 1) find listings whose paid_until <= now() and still active
    const expired = await db.manyOrNone(
      `SELECT id, owner_id, title FROM listings
       WHERE paid_until IS NOT NULL
         AND paid_until <= now()
         AND is_active = true`
    );

    if (expired && expired.length) {
      for (const l of expired) {
        await listingModel.expireListing(l.id);

        // optional: record reminder/audit, send message
        try {
          const conv = await messageModel.createConversation({
            subject: `Listing #${l.id} expired`,
            memberIds: [l.owner_id]
          });
          await messageModel.addMessage({
            conversation_id: conv.id,
            sender_id: 1, // system/admin id if you have one; or null
            body: `Your listing "${l.title}" has expired because subscription ended. Please renew to make it active again.`
          });
        } catch (e) {
          console.warn('notify owner failed for expired listing', l.id, e);
        }
      }
    }

    // 2) optionally: send reminders for upcoming expirations (e.g. 3 days left)
    const warnings = await db.manyOrNone(
      `SELECT id, owner_id, title, paid_until FROM listings
       WHERE paid_until IS NOT NULL
         AND paid_until > now()
         AND paid_until <= now() + interval '3 days'
         AND status != 'deleted'`
    );

    for (const w of warnings) {
      // ensure idempotent by checking listing_reminders table or set a unique constraint
      const already = await db.oneOrNone('SELECT 1 FROM listing_reminders WHERE listing_id=$1 AND reminder_type=$2', [w.id, 'expiry_warning']);
      if (!already) {
        await db.none('INSERT INTO listing_reminders(listing_id, reminder_type, sent_at) VALUES($1,$2,now())', [w.id, 'expiry_warning']);
        // send message/email similarly
      }
    }
  } catch (err) {
    console.error('expireListings job error', err);
  }
});

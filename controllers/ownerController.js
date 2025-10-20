// controllers/ownerController.js
const db = require('../models/db');
const listingImageModel = require('../models/listingImageModel');
const messageModel = require('../models/messageModel');

exports.dashboard = async (req, res) => {
  try {
    const listings = await db.manyOrNone('SELECT * FROM listings WHERE owner_id=$1 ORDER BY created_at DESC', [req.user.id]);

    const enhanced = await Promise.all(listings.map(async l => {
      const images = await listingImageModel.getImages(l.id);
      return { ...l, images };
    }));

    // fetch conversations and last message
    const convs = await messageModel.getConversationsForUser(req.user.id);
    const convsWithLast = await Promise.all(convs.map(async c => {
      const msgs = await messageModel.getMessagesForConversation(c.id);
      const last = msgs && msgs.length ? msgs[msgs.length - 1] : null;
      return { ...c, lastMessage: last };
    }));

    return res.render('owner/dashboard', { listings: enhanced, conversations: convsWithLast, user: req.user });
  } catch (err) {
    console.error('owner.dashboard error', err);
    req.flash('error', 'Unable to load your dashboard');
    return res.redirect('/');
  }
};

// controllers/reviewController.js
const reviewModel = require('../models/reviewModel');

exports.postReview = async (req, res) => {
  try {
    const { listing_id, rating, comment } = req.body;
    if (!req.user) return res.json({ ok:false, error:'Authentication required' });
    if (!listing_id || !comment) return res.json({ ok:false, error:'Missing fields' });
    await reviewModel.createReview({ listing_id: parseInt(listing_id,10), user_id: req.user.id, rating: parseInt(rating || 5,10), comment });
    return res.json({ ok:true });
  } catch (err) {
    console.error('postReview error', err);
    return res.json({ ok:false, error: 'Server error' });
  }
};

exports.postReply = async (req, res) => {
  try {
    const { listing_id, parent_id, comment } = req.body;
    if (!req.user) return res.json({ ok:false, error:'Authentication required' });
    if (!listing_id || !parent_id || !comment) return res.json({ ok:false, error:'Missing fields' });
    await reviewModel.createReply({ listing_id: parseInt(listing_id,10), user_id: req.user.id, parent_id: parseInt(parent_id,10), comment });
    return res.json({ ok:true });
  } catch (err) {
    console.error('postReply error', err);
    return res.json({ ok:false, error: 'Server error' });
  }
};

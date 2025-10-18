// controllers/reviewController.js
const reviewModel = require('../models/reviewModel');

exports.getReviewsJson = async (req, res) => {
  try {
    const listingId = parseInt(req.params.listingId, 10);
    if (Number.isNaN(listingId)) return res.status(400).json({ ok: false, error: 'Invalid listing id' });

    const reviews = await reviewModel.getReviewsForListing(listingId); // returns top-level with replies
    return res.json({ ok: true, reviews });
  } catch (err) {
    console.error('getReviewsJson error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};

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

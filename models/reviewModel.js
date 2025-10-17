// models/reviewModel.js
const db = require('./db');

async function getReviewsForListing(listingId) {
  return db.manyOrNone('SELECT r.*, u.name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.listing_id=$1 ORDER BY r.created_at DESC', [listingId]);
}

module.exports = { getReviewsForListing };

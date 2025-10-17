// models/reviewModel.js
const db = require('./db');

async function getReviewsForListing(listingId) {
  // get top-level reviews (parent_id IS NULL) with author name
  const reviews = await db.manyOrNone(
    `SELECT r.id, r.listing_id, r.user_id, r.rating, r.comment, r.parent_id, r.created_at, u.name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.listing_id = $1 AND r.parent_id IS NULL
     ORDER BY r.created_at DESC`, [listingId]
  );

  // for each review fetch replies
  const enhanced = await Promise.all(reviews.map(async r => {
    const replies = await db.manyOrNone(
      `SELECT r.id, r.listing_id, r.user_id, r.comment, r.parent_id, r.created_at, u.name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.parent_id = $1 ORDER BY r.created_at ASC`, [r.id]
    );
    return { ...r, replies };
  }));
  return enhanced;
}

async function createReview({ listing_id, user_id, rating, comment }) {
  const q = `INSERT INTO reviews(listing_id, user_id, rating, comment, parent_id, created_at) VALUES($1,$2,$3,$4,NULL,now()) RETURNING id`;
  return db.one(q, [listing_id, user_id, rating, comment]);
}

async function createReply({ listing_id, user_id, parent_id, comment }) {
  const q = `INSERT INTO reviews(listing_id, user_id, comment, parent_id, created_at) VALUES($1,$2,$3,$4,now()) RETURNING id`;
  return db.one(q, [listing_id, user_id, comment, parent_id]);
}

module.exports = { getReviewsForListing, createReview, createReply };

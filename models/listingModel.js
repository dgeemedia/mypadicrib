// models/listingModel.js
const db = require('./db');

async function getAllListings() {
  const q = `SELECT l.id, l.owner_id, l.title, l.description, l.state, l.lga, l.address, l.price,
                    COALESCE(min(li.image_path),'') AS image_path,
                    l.created_at
             FROM listings l
             LEFT JOIN listing_images li ON li.listing_id = l.id
             WHERE l.is_active = true AND l.status = 'approved'
             GROUP BY l.id
             ORDER BY l.created_at DESC`;
  return db.manyOrNone(q);
}

async function getListingById(id) {
  const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [id]);
  const images = await db.manyOrNone('SELECT id, image_path FROM listing_images WHERE listing_id=$1 ORDER BY id', [id]);
  return { listing, images };
}

async function countOwnerListings(ownerId) {
  const r = await db.one('SELECT COUNT(*)::int AS cnt FROM listings WHERE owner_id=$1', [ownerId]);
  return parseInt(r.cnt, 10);
}

async function createListing({ owner_id, title, description, state, lga, address, price, listing_fee_paid = false, listing_fee_amount = 0 }) {
  const q = `INSERT INTO listings(owner_id, title, description, state, lga, address, price, is_active, status, listing_fee_paid, listing_fee_amount, created_at)
             VALUES($1,$2,$3,$4,$5,$6,$7,false,'pending',$8,$9,now()) RETURNING id`;
  return db.one(q, [owner_id, title, description, state, lga, address, price, listing_fee_paid, listing_fee_amount]);
}

async function setListingStatus(id, status, isActive = false) {
  return db.none('UPDATE listings SET status=$1, is_active=$2 WHERE id=$3', [status, isActive, id]);
}

async function markListingFeePaid(listingId) {
  await db.none('UPDATE listings SET listing_fee_paid = true WHERE id=$1', [listingId]);
  return db.none('UPDATE listing_fees SET paid = true WHERE listing_id=$1', [listingId]);
}

module.exports = {
  getAllListings,
  getListingById,
  countOwnerListings,
  createListing,
  setListingStatus,
  markListingFeePaid
};

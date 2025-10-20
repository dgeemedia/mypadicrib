// models/listingVerificationModel.js
const db = require('./db');

async function createVerification({ listing_id, owner_id, selfie_path, id_card_path, id_number }) {
  const q = `INSERT INTO listing_verifications(listing_id, owner_id, selfie_path, id_card_path, id_number, status, created_at)
             VALUES($1,$2,$3,$4,$5,'pending', now()) RETURNING id`;
  return db.one(q, [listing_id, owner_id, selfie_path, id_card_path, id_number]);
}

async function getByListingId(listingId) {
  return db.oneOrNone('SELECT * FROM listing_verifications WHERE listing_id=$1', [listingId]);
}

async function getPendingVerifications() {
  return db.manyOrNone(`SELECT lv.*, l.title, l.price, u.name AS owner_name
                        FROM listing_verifications lv
                        JOIN listings l ON l.id = lv.listing_id
                        JOIN users u ON u.id = lv.owner_id
                        WHERE lv.status = 'pending'
                        ORDER BY lv.created_at DESC`);
}

async function updateStatus(id, status, adminNotes = null) {
  return db.none('UPDATE listing_verifications SET status=$1, admin_notes=$2 WHERE id=$3', [status, adminNotes, id]);
}

module.exports = { createVerification, getByListingId, getPendingVerifications, updateStatus };

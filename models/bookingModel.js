// models/bookingModel.js
const db = require('./db');

async function createBooking({ listing_id, user_id, start_date, end_date, total_price, laundry_requested = false }) {
  const q = `INSERT INTO bookings(listing_id, user_id, start_date, end_date, total_price, laundry_requested, created_at)
             VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id`;
  return db.one(q, [listing_id, user_id, start_date, end_date, total_price, laundry_requested]);
}

module.exports = { createBooking };

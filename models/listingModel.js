const db = require('./db');

/**
 * Returns approved & active listings (one image as thumbnail where available)
 */
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

/**
 * Fetch single listing row + all images
 */
async function getListingById(id) {
  const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [id]);
  const images = await db.manyOrNone('SELECT id, image_path FROM listing_images WHERE listing_id=$1 ORDER BY id', [id]);
  return { listing, images };
}

/**
 * Count how many listings an owner has (used to determine listing fee)
 */
async function countOwnerListings(ownerId) {
  const r = await db.one('SELECT COUNT(*)::int AS cnt FROM listings WHERE owner_id=$1', [ownerId]);
  return parseInt(r.cnt, 10);
}

/**
 * Create a listing (initially pending and inactive)
 */
async function createListing({ owner_id, title, description, state, lga, address, price, listing_fee_paid = false, listing_fee_amount = 0 }) {
  const q = `INSERT INTO listings(owner_id, title, description, state, lga, address, price, is_active, status, listing_fee_paid, listing_fee_amount, created_at)
             VALUES($1,$2,$3,$4,$5,$6,$7,false,'pending',$8,$9,now()) RETURNING id`;
  return db.one(q, [owner_id, title, description, state, lga, address, price, listing_fee_paid, listing_fee_amount]);
}

/**
 * Set listing status + active flag
 */
async function setListingStatus(id, status, isActive = false) {
  return db.none('UPDATE listings SET status=$1, is_active=$2 WHERE id=$3', [status, isActive, id]);
}

/**
 * Mark listing fee paid both on listings and in listing_fees table
 */
async function markListingFeePaid(listingId) {
  await db.none('UPDATE listings SET listing_fee_paid = true WHERE id=$1', [listingId]);
  return db.none('UPDATE listing_fees SET paid = true WHERE listing_id=$1', [listingId]);
}

/**
 * Suspend a listing (soft-suspend)
 */
async function suspendListing(id) {
  return db.none('UPDATE listings SET status=$1, is_active=false WHERE id=$2', ['suspended', id]);
}

/**
 * Reactivate a suspended listing (set approved + active)
 */
async function reactivateListing(id) {
  return db.none('UPDATE listings SET status=$1, is_active=true WHERE id=$2', ['approved', id]);
}

/**
 * Soft-delete a listing: keep rows but mark deleted
 * - sets status='deleted', is_active=false, deleted_at=now()
 * - attempts to insert an audit row into listing_actions (if that table exists)
 */
async function softDeleteListing(id, { adminId = null, reason = null } = {}) {
  // mark listing deleted
  await db.none(
    `UPDATE listings
     SET status = $1, is_active = false, deleted_at = now()
     WHERE id = $2`,
    ['deleted', id]
  );

  // optional audit table insert (create listing_actions/listing_audits) — example:
  try {
    await db.none(
      `INSERT INTO listing_actions(listing_id, admin_id, action, reason, created_at)
       VALUES($1,$2,$3,$4, now())`,
      [id, adminId, 'soft_delete', reason]
    );
  } catch (e) {
    // ignore if audit table not present
  }
}

/**
 * Hard-delete listing and related rows in a transaction.
 * Returns an object with deleted listing info and array of image paths
 * so controllers can remove files from disk if desired.
 *
 * NOTE: this permanently removes data. Use carefully.
 */
async function hardDeleteListing(id) {
  return db.tx(async t => {
    // fetch current image paths and verification paths first
    const images = await t.manyOrNone('SELECT image_path FROM listing_images WHERE listing_id=$1', [id]);
    const verification = await t.oneOrNone('SELECT selfie_path, id_card_path FROM listing_verifications WHERE listing_id=$1', [id]);

    // delete dependent rows
    await t.none('DELETE FROM listing_images WHERE listing_id=$1', [id]);
    await t.none('DELETE FROM listing_fees WHERE listing_id=$1', [id]);
    await t.none('DELETE FROM listing_verifications WHERE listing_id=$1', [id]);
    await t.none('DELETE FROM bookings WHERE listing_id=$1', [id]);
    await t.none('DELETE FROM reviews WHERE listing_id=$1', [id]);
    // delete listing itself and return id to confirm deletion
    const deleted = await t.oneOrNone('DELETE FROM listings WHERE id=$1 RETURNING id, title', [id]);

    return {
      deleted,
      images,        // [{image_path}, ...]
      verification   // { selfie_path, id_card_path } or null
    };
  });
}

// mark a listing as payment required (call after create if fee required)
async function markPaymentRequired(id) {
  return db.none(
    `UPDATE listings
     SET status = $1, is_active = false
     WHERE id = $2`,
    ['payment_required', id]
  );
}

// suspend a listing (admin)
async function suspendListingByAdmin(id, { adminId = null, reason = null } = {}) {
  await db.none('UPDATE listings SET status=$1, is_active=false WHERE id=$2', ['suspended', id]);

  // optional audit insert
  try {
    await db.none(
      `INSERT INTO listing_actions(listing_id, admin_id, action, reason, created_at)
       VALUES($1,$2,$3,$4, now())`,
      [id, adminId, 'suspend', reason]
    );
  } catch (e) { /* ignore if audit missing */ }
}

/**
 * Set listing as paid for a billing period (called on successful payment/webhook)
 * period: 'monthly' or 'yearly'
 * amount: numeric (optional)
 * invoiceRef: string optional
 */
async function setListingPaidUntil(listingId, { period = 'monthly', startsAt = null, amount = 0, invoiceRef = null } = {}) {
  // compute ends_at using SQL interval to avoid timezone math in JS
  const start = startsAt ? startsAt : new Date();
  const interval = (period === 'yearly') ? "interval '1 year'" : "interval '1 month'";

  return db.tx(async t => {
    // calculate ends_at in SQL and update listing.paid_until, listing.payment_plan, listing.listing_fee_paid
    const row = await t.one(
      `UPDATE listings
       SET paid_until = ( $2::timestamptz + ${interval} )::timestamptz,
           listing_fee_paid = true,
           payment_plan = $3,
           is_active = true -- reactivate when paid
       WHERE id = $1
       RETURNING id, paid_until`,
      [listingId, start, period]
    );

    // insert a payment record into listing_fees for history
    await t.none(
      `INSERT INTO listing_fees(listing_id, owner_id, amount, paid, payment_ref, starts_at, ends_at, created_at, period)
       VALUES ($1, (SELECT owner_id FROM listings WHERE id=$1), $2, true, $3, $4::timestamptz, ($4::timestamptz + ${interval})::timestamptz, now(), $5)`,
      [listingId, amount, invoiceRef, start, period]
    );

    return row;
  });
}

/**
 * Mark listing inactive when expired
 */
async function expireListing(listingId) {
  return db.none(
    `UPDATE listings
     SET is_active = false, status = 'suspended'
     WHERE id = $1`,
    [listingId]
  );
}

/**
 * Renew listing manually (owner action) — wrapper around setListingPaidUntil
 */
async function renewListing(listingId, { period = 'monthly', amount = 0, invoiceRef = null } = {}) {
  return setListingPaidUntil(listingId, { period, amount, startsAt: new Date(), invoiceRef });
}

module.exports = {
  getAllListings,
  getListingById,
  countOwnerListings,
  createListing,
  setListingStatus,
  markListingFeePaid,
  suspendListing,
  reactivateListing,
  softDeleteListing,
  markPaymentRequired,
  suspendListingByAdmin,
  hardDeleteListing,
  setListingPaidUntil,
  expireListing,
  renewListing
};

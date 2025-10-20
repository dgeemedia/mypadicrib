// models/userModel.js
const db = require('./db');

/**
 * createUser
 */
async function createUser({ name, email, phone, password_hash, role = 'user' }) {
  const q = `INSERT INTO users(name,email,phone,password_hash,role,created_at)
             VALUES($1,$2,$3,$4,$5,now()) RETURNING id, name, email, phone, role, created_at`;
  return db.one(q, [name, email, phone, password_hash, role]);
}

/**
 * findByEmail - returns full user row (including password_hash)
 */
async function findByEmail(email) {
  return db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
}

/**
 * findById - returns public user fields plus status & suspended_until
 */
async function findById(id) {
  return db.oneOrNone(
    'SELECT id, name, email, phone, role, status, suspended_until FROM users WHERE id=$1',
    [id]
  );
}

/**
 * suspendUser
 *  - id: user id
 *  - opts: { suspendedUntil (string|null), adminId (int|null), reason (string|null), meta (object|null) }
 */
async function suspendUser(id, { suspendedUntil = null, adminId = null, reason = null, meta = null } = {}) {
  // update user row
  await db.none('UPDATE users SET status = $1, suspended_until = $2 WHERE id = $3', ['suspended', suspendedUntil, id]);

  // record audit entry (metadata as JSONB if provided)
  const metadata = meta ? JSON.stringify(meta) : null;
  await db.none(
    'INSERT INTO user_suspensions(user_id, admin_id, action, reason, metadata, created_at) VALUES($1,$2,$3,$4,$5, now())',
    [id, adminId, 'suspend', reason, metadata]
  );
}

/**
 * reactivateUser
 *  - id: user id
 *  - opts: { adminId (int|null), reason (string|null), meta (object|null) }
 */
async function reactivateUser(id, { adminId = null, reason = null, meta = null } = {}) {
  await db.none('UPDATE users SET status = $1, suspended_until = NULL WHERE id = $2', ['active', id]);

  const metadata = meta ? JSON.stringify(meta) : null;
  await db.none(
    'INSERT INTO user_suspensions(user_id, admin_id, action, reason, metadata, created_at) VALUES($1,$2,$3,$4,$5, now())',
    [id, adminId, 'reinstate', reason, metadata]
  );
}

/**
 * hardDeleteUser - permanently remove user and related data in a transaction
 * NOTE: this is destructive. Keep for admin-only use.
 */
async function hardDeleteUser(id) {
  return db.tx(async t => {
    // remove user-owned listings (and dependents)
    const listings = await t.manyOrNone('SELECT id FROM listings WHERE owner_id = $1', [id]);
    const listingIds = listings.map(r => r.id);
    if (listingIds.length) {
      await t.none('DELETE FROM listing_images WHERE listing_id = ANY($1::int[])', [listingIds]);
      await t.none('DELETE FROM listing_fees WHERE listing_id = ANY($1::int[])', [listingIds]);
      await t.none('DELETE FROM listing_verifications WHERE listing_id = ANY($1::int[])', [listingIds]);
      await t.none('DELETE FROM bookings WHERE listing_id = ANY($1::int[])', [listingIds]);
      await t.none('DELETE FROM reviews WHERE listing_id = ANY($1::int[])', [listingIds]);
      await t.none('DELETE FROM listings WHERE id = ANY($1::int[])', [listingIds]);
    }

    // remove other user data
    await t.none('DELETE FROM reviews WHERE user_id = $1', [id]);

    // if you have a sessions table, remove session rows (wrap in try/catch in case table absent)
    try {
      await t.none('DELETE FROM sessions WHERE user_id = $1', [id]);
    } catch (e) {
      // ignore if sessions table doesn't exist
    }

    // remove messages or anonymize depending on policy:
    await t.none('DELETE FROM messages WHERE sender_id = $1', [id]);
    await t.none('DELETE FROM conversation_members WHERE user_id = $1', [id]);

    // finally delete user and return deleted row
    const deleted = await t.oneOrNone('DELETE FROM users WHERE id = $1 RETURNING id, name, email', [id]);
    return deleted;
  });
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  suspendUser,
  reactivateUser,
  hardDeleteUser
};

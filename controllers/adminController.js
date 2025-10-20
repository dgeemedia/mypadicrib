// controllers/adminController.js
const db = require('../models/db');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const messageModel = require('../models/messageModel');
const userModel = require('../models/userModel');

//
// Admin dashboard (lists pending listings + users)
//
exports.dashboard = async (req, res) => {
  try {
    const pending = await db.manyOrNone(
      `SELECT l.*, u.name AS owner_name, lv.selfie_path, lv.id_card_path, lv.id_number, lv.id as verification_id
       FROM listings l
       LEFT JOIN users u ON u.id = l.owner_id
       LEFT JOIN listing_verifications lv ON lv.listing_id = l.id
       WHERE l.status=$1
       ORDER BY l.created_at DESC`, ['pending']
    );

    const users = await db.manyOrNone(
      `SELECT id, name, email, role, status, suspended_until, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.render('admin/dashboard', { pending, users });
  } catch (err) {
    console.error('admin.dashboard error', err);
    req.flash('error', 'Unable to load admin dashboard');
    return res.redirect('/');
  }
};

//
// Helper: find existing verification conversation for a listing (by subject LIKE)
//
async function findVerificationConversationForListing(listingId) {
  const row = await db.oneOrNone(
    `SELECT c.id FROM conversations c
     WHERE c.subject ILIKE $1
     ORDER BY c.id DESC
     LIMIT 1`, [`%Verification for listing #${listingId}%`]
  );
  return row ? row.id : null;
}

//
// LISTINGS: approve / reject / serve files / suspend / reactivate / delete
//
exports.approveListing = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [id]);
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/admin');
    }
    if (!listing.listing_fee_paid && listing.listing_fee_amount > 0) {
      req.flash('error', 'Listing fee unpaid. Cannot approve.');
      return res.redirect('/admin');
    }

    await db.none('UPDATE listings SET status=$1, is_active=true WHERE id=$2', ['approved', id]);
    await db.none('UPDATE listing_verifications SET status=$1 WHERE listing_id=$2', ['approved', id]);

    try {
      let convId = await findVerificationConversationForListing(id);
      if (convId) {
        await messageModel.addMessage({
          conversation_id: convId,
          sender_id: req.user.id,
          body: `Your listing "${listing.title}" has been approved and is now live.`
        });
      } else {
        const conv = await messageModel.createConversation({
          subject: `Listing #${id} approved`,
          memberIds: [listing.owner_id, req.user.id]
        });
        await messageModel.addMessage({
          conversation_id: conv.id,
          sender_id: req.user.id,
          body: `Your listing "${listing.title}" has been approved and is now live.`
        });
      }
    } catch (msgErr) {
      console.error('approveListing message send error', msgErr);
    }

    req.flash('success', 'Listing approved');
    return res.redirect('/admin');
  } catch (err) {
    console.error('approveListing error', err);
    req.flash('error', 'Could not approve listing');
    return res.redirect('/admin');
  }
};

exports.rejectListing = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reason = (req.body && req.body.reason) ? req.body.reason : 'No reason provided';
    const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [id]);
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/admin');
    }

    await db.none('UPDATE listings SET status=$1 WHERE id=$2', ['rejected', id]);
    await db.none('UPDATE listing_verifications SET status=$1 WHERE listing_id=$2', ['rejected', id]);

    try {
      let convId = await findVerificationConversationForListing(id);
      if (convId) {
        await messageModel.addMessage({
          conversation_id: convId,
          sender_id: req.user.id,
          body: `Your listing "${listing.title}" was rejected. Reason: ${reason}`
        });
      } else {
        const conv = await messageModel.createConversation({
          subject: `Listing #${id} rejected`,
          memberIds: [listing.owner_id, req.user.id]
        });
        await messageModel.addMessage({
          conversation_id: conv.id,
          sender_id: req.user.id,
          body: `Your listing "${listing.title}" was rejected. Reason: ${reason}`
        });
      }
    } catch (msgErr) {
      console.error('rejectListing message send error', msgErr);
    }

    req.flash('success', 'Listing rejected');
    return res.redirect('/admin');
  } catch (err) {
    console.error('rejectListing error', err);
    req.flash('error', 'Could not reject');
    return res.redirect('/admin');
  }
};

exports.serveVerificationFile = async (req, res) => {
  try {
    const verificationId = parseInt(req.params.verificationId, 10);
    const type = req.params.type;
    if (!['selfie', 'id_card'].includes(type)) {
      return res.status(400).send('Invalid file type requested');
    }

    const rec = await db.oneOrNone('SELECT selfie_path, id_card_path FROM listing_verifications WHERE id=$1', [verificationId]);
    if (!rec) {
      console.warn(`serveVerificationFile: no verification record for id=${verificationId}`);
      return res.status(404).send('Verification record not found');
    }

    const rawPath = (type === 'selfie') ? rec.selfie_path : rec.id_card_path;
    if (!rawPath) {
      console.warn(`serveVerificationFile: no ${type}_path on verification id=${verificationId}`, rec);
      return res.status(404).send('File not found');
    }

    const filename = path.basename(String(rawPath));
    if (!filename) {
      console.warn('serveVerificationFile: could not derive filename from rawPath:', rawPath);
      return res.status(404).send('File not found');
    }

    const secureDir = path.resolve(process.cwd(), 'secure_uploads');
    const abs = path.join(secureDir, filename);
    const resolved = path.resolve(abs);
    if (!resolved.startsWith(secureDir)) {
      console.error('serveVerificationFile: resolved path outside secure dir', { secureDir, resolved });
      return res.status(403).send('Forbidden');
    }

    console.info(`serveVerificationFile: verificationId=${verificationId}, type=${type}, rawPath=${rawPath}, filename=${filename}, abs=${abs}`);

    if (!fs.existsSync(abs)) {
      console.warn('serveVerificationFile: file does not exist', abs);
      return res.status(404).send('File not found');
    }

    return res.sendFile(abs, (err) => {
      if (err) {
        console.error('serveVerificationFile: sendFile error', err && err.stack ? err.stack : err);
        if (!res.headersSent) res.status(500).send('Server error');
      }
    });
  } catch (err) {
    console.error('serveVerificationFile unexpected error', err && err.stack ? err.stack : err);
    return res.status(500).send('Server error');
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const hash = bcrypt.hashSync(password, 8);
    await db.none('INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES($1,$2,$3,$4,$5,now())', [name, email, phone, hash, 'staff']);
    req.flash('success', 'Staff account created');
    return res.redirect('/admin');
  } catch (err) {
    console.error('createStaff error', err);
    req.flash('error', 'Could not create staff');
    return res.redirect('/admin');
  }
};

exports.addProvider = async (req, res) => {
  try {
    const { type, name, phone, email } = req.body;
    if (type === 'laundry') {
      await db.none('INSERT INTO laundry_providers(name,phone,email,created_at) VALUES($1,$2,$3,now())', [name, phone, email]);
    } else if (type === 'food') {
      await db.none('INSERT INTO food_vendors(name,phone,email,created_at) VALUES($1,$2,$3,now())', [name, phone, email]);
    }
    req.flash('success', 'Provider added');
    return res.redirect('/admin');
  } catch (err) {
    console.error('addProvider error', err);
    req.flash('error', 'Could not add provider');
    return res.redirect('/admin');
  }
};

exports.suspendListing = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reason = (req.body && req.body.reason) ? req.body.reason : 'No reason provided';
    const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [id]);
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/admin');
    }

    await db.none('UPDATE listings SET status=$1, is_active=false, suspended_until=NULL WHERE id=$2', ['suspended', id]);

    try {
      let convId = await findVerificationConversationForListing(id);
      const body = `Your listing "${listing.title}" has been suspended by admin. Reason: ${reason}`;
      if (convId) {
        await messageModel.addMessage({ conversation_id: convId, sender_id: req.user.id, body });
      } else {
        const conv = await messageModel.createConversation({
          subject: `Listing #${id} suspended`,
          memberIds: [listing.owner_id, req.user.id]
        });
        await messageModel.addMessage({ conversation_id: conv.id, sender_id: req.user.id, body });
      }
    } catch (msgErr) {
      console.error('suspendListing message send error', msgErr);
    }

    req.flash('success', 'Listing suspended');
    return res.redirect('/admin');
  } catch (err) {
    console.error('suspendListing error', err);
    req.flash('error', 'Could not suspend listing');
    return res.redirect('/admin');
  }
};

exports.reactivateListing = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [id]);
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/admin');
    }

    await db.none('UPDATE listings SET status=$1, is_active=true, suspended_until=NULL WHERE id=$2', ['approved', id]);

    try {
      let convId = await findVerificationConversationForListing(id);
      const body = `Your listing "${listing.title}" has been reactivated and is now live.`;
      if (convId) {
        await messageModel.addMessage({ conversation_id: convId, sender_id: req.user.id, body });
      } else {
        const conv = await messageModel.createConversation({
          subject: `Listing #${id} reactivated`,
          memberIds: [listing.owner_id, req.user.id]
        });
        await messageModel.addMessage({ conversation_id: conv.id, sender_id: req.user.id, body });
      }
    } catch (msgErr) {
      console.error('reactivateListing message send error', msgErr);
    }

    req.flash('success', 'Listing reactivated');
    return res.redirect('/admin');
  } catch (err) {
    console.error('reactivateListing error', err);
    req.flash('error', 'Could not reactivate listing');
    return res.redirect('/admin');
  }
};

exports.deleteListing = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const listing = await db.oneOrNone('SELECT * FROM listings WHERE id=$1', [id]);
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/admin');
    }

    const images = await db.manyOrNone('SELECT image_path FROM listing_images WHERE listing_id=$1', [id]);

    await db.tx(async t => {
      await t.none('DELETE FROM listing_images WHERE listing_id=$1', [id]);
      await t.none('DELETE FROM listing_fees WHERE listing_id=$1', [id]);
      await t.none('DELETE FROM listing_verifications WHERE listing_id=$1', [id]);
      await t.none('DELETE FROM bookings WHERE listing_id=$1', [id]);
      await t.none('DELETE FROM reviews WHERE listing_id=$1', [id]);
      await t.none('DELETE FROM listings WHERE id=$1', [id]);
    });

    try {
      const safeUnlink = p => {
        try {
          const fp = path.join(process.cwd(), p.replace(/^\//, ''));
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch (e) {
          console.warn('Failed unlink file', p, e.message || e);
        }
      };
      images.forEach(r => { if (r && r.image_path) safeUnlink(r.image_path); });
      const ver = await db.oneOrNone('SELECT selfie_path, id_card_path FROM listing_verifications WHERE listing_id=$1', [id]);
      if (ver) { safeUnlink(ver.selfie_path); safeUnlink(ver.id_card_path); }
    } catch (fileErr) {
      console.warn('deleteListing: file deletion warnings', fileErr);
    }

    try {
      let convId = await findVerificationConversationForListing(id);
      const body = `Your listing "${listing.title}" has been permanently deleted by admin. If you believe this was a mistake contact support.`;
      if (convId) {
        await messageModel.addMessage({ conversation_id: convId, sender_id: req.user.id, body });
      } else {
        const conv = await messageModel.createConversation({
          subject: `Listing #${id} deleted`,
          memberIds: [listing.owner_id, req.user.id]
        });
        await messageModel.addMessage({ conversation_id: conv.id, sender_id: req.user.id, body });
      }
    } catch (msgErr) {
      console.error('deleteListing message send error', msgErr);
    }

    req.flash('success', 'Listing deleted');
    return res.redirect('/admin');
  } catch (err) {
    console.error('deleteListing error', err && err.stack ? err.stack : err);
    req.flash('error', 'Could not delete listing');
    return res.redirect('/admin');
  }
};

//
// USER MANAGEMENT: list / suspend / reactivate / delete
//
exports.listUsers = async (req, res) => {
  try {
    const users = await db.manyOrNone('SELECT id, name, email, role, status, suspended_until, created_at FROM users ORDER BY created_at DESC');
    const pending = await db.manyOrNone(
      `SELECT l.*, u.name AS owner_name, lv.selfie_path, lv.id_card_path, lv.id_number, lv.id as verification_id
       FROM listings l
       LEFT JOIN users u ON u.id = l.owner_id
       LEFT JOIN listing_verifications lv ON lv.listing_id = l.id
       WHERE l.status=$1
       ORDER BY l.created_at DESC`, ['pending']
    );
    return res.render('admin/dashboard', { pending, users });
  } catch (err) {
    console.error('admin.listUsers error', err);
    req.flash('error', 'Unable to load users');
    return res.redirect('/admin');
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const suspended_until = req.body.suspended_until && req.body.suspended_until.trim() !== '' ? req.body.suspended_until : null;
    const reason = req.body.reason || 'Violation of platform rules';

    // call userModel with an options object
    await userModel.suspendUser(id, { suspendedUntil: suspended_until, adminId: req.user.id, reason });

    try {
      const conv = await messageModel.createConversation({
        subject: `Account suspended`,
        memberIds: [id, req.user.id]
      });
      await messageModel.addMessage({
        conversation_id: conv.id,
        sender_id: req.user.id,
        body: `Your account has been suspended. Reason: ${reason}${suspended_until ? ' until ' + suspended_until : ''}`
      });
    } catch (e) { console.warn('suspend notification failed', e); }

    req.flash('success', 'User suspended');
    return res.redirect('/admin/users');
  } catch (err) {
    console.error('suspendUser error', err);
    req.flash('error', 'Could not suspend user');
    return res.redirect('/admin/users');
  }
};

exports.reactivateUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const reason = req.body.reason || 'Restitution confirmed';
    await userModel.reactivateUser(id, { adminId: req.user.id, reason });

    try {
      const conv = await messageModel.createConversation({
        subject: `Account reactivated`,
        memberIds: [id, req.user.id]
      });
      await messageModel.addMessage({
        conversation_id: conv.id,
        sender_id: req.user.id,
        body: `Your account has been reactivated. Note: ${reason}`
      });
    } catch (e) { console.warn('reactivate notification failed', e); }

    req.flash('success', 'User reactivated');
    return res.redirect('/admin/users');
  } catch (err) {
    console.error('reactivateUser error', err);
    req.flash('error', 'Could not reactivate user');
    return res.redirect('/admin/users');
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await userModel.hardDeleteUser(id);

    req.flash('success', deleted ? 'User deleted' : 'User not found');
    return res.redirect('/admin/users');
  } catch (err) {
    console.error('deleteUser error', err);
    req.flash('error', 'Could not delete user');
    return res.redirect('/admin/users');
  }
};

// controllers/adminController.js
const db = require('../models/db');
const bcrypt = require('bcryptjs');

exports.dashboard = async (req, res) => {
  try {
    const pending = await db.manyOrNone('SELECT l.*, u.name AS owner_name FROM listings l LEFT JOIN users u ON u.id = l.owner_id WHERE l.status=$1 ORDER BY l.created_at DESC', ['pending']);
    return res.render('admin/dashboard', { pending });
  } catch (err) {
    console.error('admin.dashboard error', err);
    req.flash('error', 'Unable to load admin dashboard');
    return res.redirect('/');
  }
};

// POST /admin/listings/:id/approve
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
    req.flash('success', 'Listing approved');
    return res.redirect('/admin');
  } catch (err) {
    console.error('approveListing error', err);
    req.flash('error', 'Could not approve listing');
    return res.redirect('/admin');
  }
};

// POST /admin/listings/:id/reject
exports.rejectListing = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.none('UPDATE listings SET status=$1 WHERE id=$2', ['rejected', id]);
    req.flash('success', 'Listing rejected');
    return res.redirect('/admin');
  } catch (err) {
    console.error('rejectListing error', err);
    req.flash('error', 'Could not reject');
    return res.redirect('/admin');
  }
};

// POST /admin/staff/create
exports.createStaff = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const hash = bcrypt.hashSync(password, 8);
    await db.none('INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES($1,$2,$3,$4,$5,now())', [name,email,phone,hash,'staff']);
    req.flash('success', 'Staff account created');
    return res.redirect('/admin');
  } catch (err) {
    console.error('createStaff error', err);
    req.flash('error', 'Could not create staff');
    return res.redirect('/admin');
  }
};

// POST /admin/providers/add (for laundry or food)
exports.addProvider = async (req, res) => {
  try {
    const { type, name, phone, email } = req.body; // type = 'laundry'|'food'
    if (type === 'laundry') {
      await db.none('INSERT INTO laundry_providers(name,phone,email,created_at) VALUES($1,$2,$3,now())', [name,phone,email]);
    } else if (type === 'food') {
      await db.none('INSERT INTO food_vendors(name,phone,email,created_at) VALUES($1,$2,$3,now())', [name,phone,email]);
    }
    req.flash('success', 'Provider added');
    return res.redirect('/admin');
  } catch (err) {
    console.error('addProvider error', err);
    req.flash('error', 'Could not add provider');
    return res.redirect('/admin');
  }
};

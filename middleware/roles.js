// middleware/roles.js
const db = require('../models/db');

module.exports = {
  // roles: array or single role string
  ensureRole: (roles = []) => (req, res, next) => {
    if (!req.user) {
      req.flash('error', 'Please log in');
      return res.redirect('/auth/login');
    }
    if (!Array.isArray(roles)) roles = [roles];
    if (roles.includes(req.user.role) || roles.includes('*')) return next();
    req.flash('error', 'Not authorized');
    return res.redirect('/');
  },

  // ensures current user owns the listing or is admin/staff
  ensureOwnerOfListing: () => async (req, res, next) => {
    try {
      const listingId = parseInt(req.params.id || req.body.listingId, 10);
      if (!listingId) {
        req.flash('error', 'Missing listing id');
        return res.redirect('back');
      }
      if (!req.user) {
        req.flash('error', 'Please log in');
        return res.redirect('/auth/login');
      }
      const row = await db.oneOrNone('SELECT owner_id FROM listings WHERE id=$1', [listingId]);
      if (!row) {
        req.flash('error', 'Listing not found');
        return res.redirect('back');
      }
      if (row.owner_id === req.user.id || req.user.role === 'admin' || req.user.role === 'staff') {
        return next();
      }
      req.flash('error', 'You do not own this listing');
      return res.redirect('back');
    } catch (err) {
      console.error('ensureOwnerOfListing error', err);
      req.flash('error', 'Server error');
      return res.redirect('back');
    }
  }
};

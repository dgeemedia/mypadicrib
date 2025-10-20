// routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureRole } = require('../middleware/roles');

// sanity check (helpful while debugging — remove in prod)
if (!adminController || typeof adminController.dashboard !== 'function') {
  console.error('adminController missing or dashboard handler undefined:', adminController);
  throw new Error('adminController.dashboard is not defined. Check ../controllers/adminController.js exports.');
}

router.get('/verification-file/:verificationId/:type', ensureRole(['admin']), adminController.serveVerificationFile);

router.get('/', ensureRole(['admin']), adminController.dashboard);
router.post('/listings/:id/approve', ensureRole(['admin']), adminController.approveListing);
router.post('/listings/:id/reject', ensureRole(['admin']), adminController.rejectListing);
router.post('/listings/:id/suspend', ensureRole(['admin']), adminController.suspendListing);
router.post('/listings/:id/reactivate', ensureRole(['admin']), adminController.reactivateListing);
router.post('/listings/:id/delete', ensureRole(['admin']), adminController.deleteListing);

// user management
router.get('/users', ensureRole(['admin']), adminController.listUsers);
router.post('/users/:id/suspend', ensureRole(['admin']), adminController.suspendUser);
router.post('/users/:id/reactivate', ensureRole(['admin']), adminController.reactivateUser);
router.post('/users/:id/delete', ensureRole(['admin']), adminController.deleteUser);

router.post('/staff/create', ensureRole(['admin']), adminController.createStaff);
router.post('/providers/add', ensureRole(['admin']), adminController.addProvider);

module.exports = router;

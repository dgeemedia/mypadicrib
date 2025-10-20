// routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureRole } = require('../middleware/roles');

router.get('/verification-file/:verificationId/:type', ensureRole(['admin']), adminController.serveVerificationFile);
router.get('/', ensureRole(['admin']), adminController.dashboard);
router.post('/listings/:id/approve', ensureRole(['admin']), adminController.approveListing);
router.post('/listings/:id/reject', ensureRole(['admin']), adminController.rejectListing);
router.post('/staff/create', ensureRole(['admin']), adminController.createStaff);
router.post('/providers/add', ensureRole(['admin']), adminController.addProvider);

module.exports = router;

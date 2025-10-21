// routes/payments.js
const express = require('express');
const router = express.Router();

// Require the payments controller (file is controllers/paymentsController.js)
const paymentsController = require('../controllers/paymentsController');
const { ensureRole } = require('../middleware/roles');

// Render checkout / renewal form (owner or user)
router.get('/checkout', ensureRole(['user','owner']), paymentsController.checkoutForm);

// Listing fee / renewal form (owner)
router.get('/listing-fee', ensureRole(['user','owner']), paymentsController.listingFeeForm);

// Simulate/submit listing-fee payment (stub for testing)
router.post('/listing-fee/pay', ensureRole(['user','owner']), paymentsController.payListingFeeStub);

// Booking payment flow (bookings are separate from listing-fee flows)
router.post('/initiate', ensureRole(['user','owner']), paymentsController.initiate);
router.post('/verify', paymentsController.verify); // provider/callbacks can POST here (stub)

// Paystack: initiate listing payment (server creates Paystack transaction and redirects owner)
router.post('/listing-initiate', ensureRole(['user','owner']), paymentsController.initiateListingPayment);

// Paystack: frontend redirect/callback after payment (optional, used when you set callback_url)
router.get('/listing-callback', paymentsController.listingCallback);

// Generic provider webhook (use express.json middleware so provider can send JSON)
router.post('/webhook', express.json(), paymentsController.webhook);

// Listing-fee / renewal webhook (provider -> server-to-server)
router.post('/webhook/listing-payment', express.json(), paymentsController.listingPaymentWebhook);

module.exports = router;

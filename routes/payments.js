// routes/payments.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { ensureRole } = require('../middleware/roles');

router.get('/checkout', ensureRole(['user','owner']), paymentController.checkoutForm);
router.post('/initiate', ensureRole(['user','owner']), paymentController.initiate);
router.post('/verify', paymentController.verify); // provider/callbacks can POST here
router.post('/webhook', express.json(), paymentController.webhook);

module.exports = router;

// routes/reviews.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/', reviewController.postReview);
router.post('/reply', reviewController.postReply);

module.exports = router;

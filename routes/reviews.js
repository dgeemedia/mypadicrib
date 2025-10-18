// routes/reviews.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Return threaded reviews for a listing (public). GET /reviews/:listingId
router.get('/:listingId', reviewController.getReviewsJson);

// Post a top-level review (authenticated)
router.post('/', reviewController.postReview);

// Post a reply to a review (authenticated)
router.post('/reply', reviewController.postReply);

module.exports = router;


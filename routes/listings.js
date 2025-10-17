// routes/listings.js
const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const upload = require('../middleware/upload');
const { ensureRole, ensureOwnerOfListing } = require('../middleware/roles');

// public listing index (approved listings)
router.get('/', listingController.index);

// create listing (owner only) — make sure /new is before /:id
router.get('/new', ensureRole(['owner']), listingController.createForm);
router.post('/new', ensureRole(['owner']), upload.array('images', 4), listingController.createPost);

// add / delete images (owner only)
router.post('/:id/images', ensureRole(['owner']), ensureOwnerOfListing(), upload.array('images', 6), listingController.addImages);
router.post('/:id/images/:imgId/delete', ensureRole(['owner']), ensureOwnerOfListing(), listingController.deleteImage);

// show listing detail (public)
router.get('/:id', listingController.show);

module.exports = router;

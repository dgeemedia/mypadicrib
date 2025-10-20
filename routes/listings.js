// routes/listings.js
const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const upload = require('../middleware/upload');
const { ensureRole, ensureOwnerOfListing } = require('../middleware/roles');

// public listing index (approved listings)
router.get('/', listingController.index);

// create listing (authenticated users can create - owners and users share signup)
router.get('/new', ensureRole(['user', 'owner']), listingController.createForm);
router.post(
  '/new',
  ensureRole(['user', 'owner']),
  upload.fields([
    { name: 'images', maxCount: 4 },   // public listing images -> uploads/
    { name: 'selfie', maxCount: 1 },   // private -> secure_uploads/
    { name: 'id_card', maxCount: 1 }   // private -> secure_uploads/
  ]),
  listingController.createPost
);

// add / delete images (user/owner only)
router.post('/:id/images', ensureRole(['user', 'owner']), ensureOwnerOfListing(), upload.array('images', 6), listingController.addImages);
router.post('/:id/images/:imgId/delete', ensureRole(['user', 'owner']), ensureOwnerOfListing(), listingController.deleteImage);

// show listing detail (public)
router.get('/:id', listingController.show);

module.exports = router;

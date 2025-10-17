// controllers/listingController.js
const listingModel = require('../models/listingModel');
const listingImageModel = require('../models/listingImageModel');
const db = require('../models/db');

exports.index = async (req, res) => {
  try {
    // get approved listings (with a first image)
    const listings = await listingModel.getAllListings();
    return res.render('listings/index', { listings, user: req.user });
  } catch (err) {
    console.error('listingController.index error', err);
    req.flash('error', 'Unable to fetch listings');
    return res.redirect('/');
  }
};

exports.show = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await listingModel.getListingById(id);
    if (!data.listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/listings');
    }
    // get reviews via DB (or reviewModel)
    const reviews = await db.manyOrNone('SELECT r.*, u.name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.listing_id=$1 ORDER BY r.created_at DESC', [id]);
    // pass user and listing.owner_id to the view so view can hide "Book" for owner of that listing
    return res.render('listings/detail', { listing: data.listing, images: data.images, reviews, user: req.user });
  } catch (err) {
    console.error('listingController.show', err);
    req.flash('error', 'Error fetching listing');
    return res.redirect('/listings');
  }
};

// GET /listings/new
exports.createForm = (req, res) => {
  return res.render('listings/new');
};

// POST /listings/new
exports.createPost = async (req, res) => {
  try {
    const { title, description, state, lga, address, price } = req.body;
    const ownerId = req.user.id;

    const ownerCount = await listingModel.countOwnerListings(ownerId);
    const requiresFee = ownerCount >= 2;
    const listingFee = parseFloat(process.env.LISTING_FEE || '5000.00');
    const feeAmount = requiresFee ? listingFee : 0.00;
    const feePaid = !requiresFee;

    const r = await listingModel.createListing({
      owner_id: ownerId,
      title,
      description,
      state,
      lga,
      address,
      price,
      listing_fee_paid: feePaid,
      listing_fee_amount: feeAmount
    });
    const listingId = r.id;

    // save files if uploaded
    if (req.files && req.files.length) {
      const paths = req.files.map(f => '/' + f.path.replace(/\\/g, '/'));
      await listingImageModel.addImages(listingId, paths);
    }

    if (requiresFee) {
      await db.none('INSERT INTO listing_fees(listing_id, owner_id, amount, paid, created_at) VALUES($1,$2,$3,false,now())', [listingId, ownerId, feeAmount]);
      req.flash('success', 'Listing created — you must pay listing fee to proceed.');
      return res.redirect(`/payments/listing-fee?listingId=${listingId}`);
    }

    req.flash('success', 'Listing created and queued for admin approval.');
    return res.redirect('/owner/dashboard');
  } catch (err) {
    console.error('createPost error', err);
    req.flash('error', 'Unable to create listing');
    return res.redirect('/listings/new');
  }
};

// POST /listings/:id/images  -> add images
exports.addImages = async (req, res) => {
  try {
    const listingId = parseInt(req.params.id, 10);
    if (!req.files || !req.files.length) {
      req.flash('error', 'No images uploaded');
      return res.redirect(`/listings/${listingId}`);
    }
    const paths = req.files.map(f => '/' + f.path.replace(/\\/g, '/'));
    await listingImageModel.addImages(listingId, paths);
    req.flash('success', 'Images uploaded');
    return res.redirect(`/listings/${listingId}`);
  } catch (err) {
    console.error('addImages error', err);
    req.flash('error', 'Upload failed');
    return res.redirect('back');
  }
};

// POST /listings/:id/images/:imgId/delete
exports.deleteImage = async (req, res) => {
  try {
    const imgId = parseInt(req.params.imgId, 10);
    const deleted = await listingImageModel.deleteImage(imgId);
    if (!deleted) {
      req.flash('error', 'Image not found');
      return res.redirect('back');
    }
    // remove file from disk if exists
    const fs = require('fs');
    const path = deleted.image_path.replace(/^\//, '');
    try { fs.unlinkSync(path); } catch (e) { /* ignore */ }
    req.flash('success', 'Image deleted');
    return res.redirect(`/listings/${req.params.id}`);
  } catch (err) {
    console.error('deleteImage error', err);
    req.flash('error', 'Could not delete image');
    return res.redirect('back');
  }
};

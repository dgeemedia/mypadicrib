// controllers/listingController.js
const listingModel = require('../models/listingModel');
const listingImageModel = require('../models/listingImageModel');
const reviewModel = require('../models/reviewModel');
const db = require('../models/db');
const fs = require('fs');
const path = require('path');

//
// INDEX - show approved listings on home page with images + review stats + latest review
//
exports.index = async (req, res) => {
  try {
    // 1) get approved listings (base info including one image_path if available)
    const listings = await listingModel.getAllListings(); // should return [] if none

    if (!listings || listings.length === 0) {
      return res.render('index', { listings: [], user: req.user });
    }

    const listingIds = listings.map(l => l.id);

    // 2) attach all images for each listing (parallel)
    const imagesPromises = listings.map(l => listingImageModel.getImages(l.id)); // returns array per listing
    const allImages = await Promise.all(imagesPromises);

    // 3) get review stats (count + average) for all listings in one query (if any reviews exist)
    let statsMap = {};
    if (listingIds.length) {
      const statsRows = await db.manyOrNone(
        `SELECT listing_id, COUNT(*)::int AS cnt, COALESCE(ROUND(AVG(rating)::numeric,2),0) AS avg
         FROM reviews
         WHERE listing_id IN ($1:csv)
         GROUP BY listing_id`, [listingIds]
      );
      statsRows.forEach(s => {
        statsMap[s.listing_id] = { count: s.cnt, avg: parseFloat(s.avg) };
      });
    }

    // 4) fetch latest review per listing (DISTINCT ON) to show excerpt
    let latestMap = {};
    if (listingIds.length) {
      const latestRows = await db.manyOrNone(
        `SELECT DISTINCT ON (r.listing_id) r.listing_id, r.comment, r.rating, u.name, r.created_at
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         WHERE r.listing_id IN ($1:csv)
         ORDER BY r.listing_id, r.created_at DESC`, [listingIds]
      );
      latestRows.forEach(r => { latestMap[r.listing_id] = r; });
    }

    // 5) merge into enriched listing objects
    const enriched = listings.map((l, idx) => {
      return {
        ...l,
        images: allImages[idx] || [], // [{id,image_path},...]
        reviewStats: statsMap[l.id] || { count: 0, avg: 0 },
        latestReview: latestMap[l.id] || null
      };
    });

    return res.render('index', { listings: enriched, user: req.user });
  } catch (err) {
    console.error('listingController.index error', err);
    req.flash('error', 'Unable to fetch listings');
    return res.redirect('/');
  }
};

//
// SHOW - listing detail with images and threaded reviews
//
exports.show = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      req.flash('error', 'Invalid listing id');
      return res.redirect('/listings');
    }

    const data = await listingModel.getListingById(id);
    if (!data || !data.listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/listings');
    }

    // threaded reviews from reviewModel
    const reviews = await reviewModel.getReviewsForListing(id);

    return res.render('listings/detail', {
      listing: data.listing,
      images: data.images || [],
      reviews: reviews || [],
      user: req.user
    });
  } catch (err) {
    console.error('listingController.show error', err);
    req.flash('error', 'Error fetching listing');
    return res.redirect('/listings');
  }
};

//
// GET /listings/new
//
exports.createForm = (req, res) => {
  return res.render('listings/new', { user: req.user });
};

//
// POST /listings/new
//
exports.createPost = async (req, res) => {
  try {
    const { title, description, state, lga, address, price } = req.body;
    const ownerId = req.user && req.user.id;
    if (!ownerId) {
      req.flash('error', 'You must be logged in to create a listing');
      return res.redirect('/auth/login');
    }

    // basic validation
    if (!title || !price) {
      req.flash('error', 'Title and price are required');
      return res.redirect('/listings/new');
    }

    // count existing owner listings to decide fee
    const ownerCount = await listingModel.countOwnerListings(ownerId);
    const requiresFee = ownerCount >= 2; // first two free, from third require fee
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
    console.error('listingController.createPost error', err);
    req.flash('error', 'Unable to create listing');
    return res.redirect('/listings/new');
  }
};

//
// POST /listings/:id/images  -> add images
//
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
    console.error('listingController.addImages error', err);
    req.flash('error', 'Upload failed');
    return res.redirect('back');
  }
};

//
// POST /listings/:id/images/:imgId/delete
//
exports.deleteImage = async (req, res) => {
  try {
    const imgId = parseInt(req.params.imgId, 10);
    const deleted = await listingImageModel.deleteImage(imgId);
    if (!deleted || !deleted.image_path) {
      req.flash('error', 'Image not found');
      return res.redirect('back');
    }

    // remove file from disk if exists
    const filepath = path.join(process.cwd(), deleted.image_path.replace(/^\//, ''));
    try {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch (e) {
      // non-fatal — just log
      console.warn('Failed to unlink image file', filepath, e.message || e);
    }

    req.flash('success', 'Image deleted');
    return res.redirect(`/listings/${req.params.id}`);
  } catch (err) {
    console.error('listingController.deleteImage error', err);
    req.flash('error', 'Could not delete image');
    return res.redirect('back');
  }
};

// controllers/listingController.js
const listingModel = require('../models/listingModel');
const listingImageModel = require('../models/listingImageModel');
const reviewModel = require('../models/reviewModel');
const db = require('../models/db');
const fs = require('fs');
const path = require('path');
const listingVerificationModel = require('../models/listingVerificationModel');
const messageModel = require('../models/messageModel');

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
    const { title, description, state, lga, address, price, id_number } = req.body;
    const ownerId = req.user && req.user.id;
    if (!ownerId) {
      req.flash('error', 'You must be logged in to create a listing');
      return res.redirect('/auth/login');
    }
    if (!title || !price) {
      req.flash('error', 'Title and price are required');
      return res.redirect('/listings/new');
    }

    // ensure verification files + id number present
    const selfieFile = req.files && req.files.selfie && req.files.selfie[0];
    const idCardFile = req.files && req.files.id_card && req.files.id_card[0];
    if (!selfieFile || !idCardFile || !id_number) {
      req.flash('error', 'Please upload a selfie, an ID card image and provide your ID number.');
      return res.redirect('/listings/new');
    }

    // count existing owner listings to decide fee
    const ownerCount = await listingModel.countOwnerListings(ownerId);
    const requiresFee = ownerCount >= 2; // first two free, from third require fee
    const listingFee = parseFloat(process.env.LISTING_FEE || '5000.00');
    const feeAmount = requiresFee ? listingFee : 0.00;
    const feePaid = !requiresFee;

    // create listing
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

    // save public listing images (images field) — store web path /uploads/<filename>
    if (req.files && req.files.images && req.files.images.length) {
      const paths = req.files.images.map(f => '/uploads/' + path.basename(f.path));
      await listingImageModel.addImages(listingId, paths);
    }

    // save verification record (store as /secure_uploads/<filename> so admin route can resolve)
    const selfiePath = '/secure_uploads/' + path.basename(selfieFile.path);
    const idCardPath = '/secure_uploads/' + path.basename(idCardFile.path);
    const ver = await listingVerificationModel.createVerification({
      listing_id: listingId,
      owner_id: ownerId,
      selfie_path: selfiePath,
      id_card_path: idCardPath,
      id_number
    });

    if (requiresFee) {
      await db.none('INSERT INTO listing_fees(listing_id, owner_id, amount, paid, created_at) VALUES($1,$2,$3,false,now())', [listingId, ownerId, feeAmount]);
      req.flash('success', 'Listing created — you must pay listing fee to proceed.');
      return res.redirect(`/payments/listing-fee?listingId=${listingId}`);
    }

    // Notify admin(s) & owner: create conversation including owner + admin
    const admin = await db.oneOrNone("SELECT id, name FROM users WHERE role='admin' ORDER BY id LIMIT 1");
    if (admin) {
      const conv = await messageModel.createConversation({
        subject: `Verification for listing #${listingId} - ${title}`,
        memberIds: [ownerId, admin.id]
      });
      await messageModel.addMessage({
        conversation_id: conv.id,
        sender_id: ownerId,
        body: `I've submitted verification for listing #${listingId}. Awaiting admin review.`
      });
    }

    req.flash('success', 'Listing created and queued for admin approval. Documents sent for verification.');
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
    // store web-friendly paths
    const paths = req.files.map(f => '/uploads/' + path.basename(f.path));
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

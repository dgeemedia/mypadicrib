// controllers/ownerController.js
const db = require('../models/db');
const listingImageModel = require('../models/listingImageModel');

exports.dashboard = async (req, res) => {
  try {
    // fetch owner listings
    const listings = await db.manyOrNone('SELECT * FROM listings WHERE owner_id=$1 ORDER BY created_at DESC', [req.user.id]);

    // attach images to each listing (parallel)
    const enhanced = await Promise.all(listings.map(async l => {
      const images = await listingImageModel.getImages(l.id); // returns array of {id, image_path}
      return { ...l, images };
    }));

    return res.render('owner/dashboard', { listings: enhanced, user: req.user });
  } catch (err) {
    console.error('owner.dashboard error', err);
    req.flash('error', 'Unable to load your dashboard');
    return res.redirect('/');
  }
};

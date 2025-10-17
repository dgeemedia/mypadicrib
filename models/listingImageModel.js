// models/listingImageModel.js
const db = require('./db');

async function addImages(listingId, images) {
  // images: array of image_path strings
  const tasks = images.map(p => db.none('INSERT INTO listing_images(listing_id, image_path) VALUES($1,$2)', [listingId, p]));
  return Promise.all(tasks);
}

async function deleteImage(imgId) {
  return db.oneOrNone('DELETE FROM listing_images WHERE id=$1 RETURNING image_path', [imgId]);
}

async function getImages(listingId) {
  return db.manyOrNone('SELECT id, image_path FROM listing_images WHERE listing_id=$1 ORDER BY id', [listingId]);
}

module.exports = { addImages, deleteImage, getImages };

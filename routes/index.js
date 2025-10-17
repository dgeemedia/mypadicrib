// routes/index.js
const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');

router.get('/', listingController.index);

module.exports = router;

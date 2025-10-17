// routes/owner.js
const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { ensureRole } = require('../middleware/roles');

router.get('/dashboard', ensureRole(['owner']), ownerController.dashboard);

module.exports = router;

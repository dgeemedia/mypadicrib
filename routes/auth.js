// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Signup
router.get('/signup', authController.getSignup);
router.post('/signup', authController.postSignup);

// Login (controller handles passport.authenticate and redirects)
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// Logout
router.get('/logout', authController.logout);

module.exports = router;

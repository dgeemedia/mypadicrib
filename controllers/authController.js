// controllers/authController.js
const bcrypt = require('bcryptjs');
const passport = require('passport');
const userModel = require('../models/userModel');

exports.getSignup = (req, res) => res.render('auth/signup');
exports.getLogin = (req, res) => res.render('auth/login');

exports.postSignup = async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    req.flash('error', 'All fields are required');
    return res.redirect('/auth/signup');
  }
  try {
    const exists = await userModel.findByEmail(email);
    if (exists) {
      req.flash('error', 'Email already registered');
      return res.redirect('/auth/signup');
    }
    const hash = bcrypt.hashSync(password, 8);
    await userModel.createUser({ name, email, phone, password_hash: hash, role: 'user' });
    req.flash('success', 'Account created. You can log in.');
    return res.redirect('/auth/login');
  } catch (err) {
    console.error('postSignup error', err);
    req.flash('error', 'An error occurred');
    return res.redirect('/auth/signup');
  }
};

// POST /auth/login
// Keeps Passport usage inside controller so route file stays simple
exports.postLogin = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', info && info.message ? info.message : 'Login failed');
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      // Redirect based on role
      if (user.role === 'admin') return res.redirect('/admin');
      if (user.role === 'staff') return res.redirect('/admin'); // staff -> admin area
      if (user.role === 'owner') return res.redirect('/owner/dashboard');
      // default for normal customers/users
      return res.redirect('/listings');
    });
  })(req, res, next);
};

exports.logout = (req, res) => {
  req.logout(function(err){
    if (err) console.error('Logout error', err);
    res.redirect('/');
  });
};

//server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 5000;

require('./models/db'); // initialize DB connection
require('./config/passport')(passport);

// view engine & layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/layout'); // default layout file (views/layouts/layout.ejs)

// middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/locations', express.static(path.join(__dirname, 'locations')));


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// expose user and flash to views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/listings', require('./routes/listings'));
app.use('/payments', require('./routes/payments'));
app.use('/admin', require('./routes/admin'));
app.use('/owner', require('./routes/owner'))
app.use('/reviews', require('./routes/reviews'));
app.use('/messages', require('./routes/messages'));


// Start
app.listen(PORT, () => {
  console.log(`mypadiCrib starter running on http://localhost:${PORT}`);
});

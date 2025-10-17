// controllers/paymentController.js
const db = require('../models/db');

exports.checkoutForm = async (req, res) => {
  // listing checkout: GET /payments/checkout?listingId=...
  return res.render('payments/checkout', { listingId: req.query.listingId, user: req.user });
};

// POST /payments/initiate  (booking payments)
exports.initiate = async (req, res) => {
  try {
    const { listingId, startDate, endDate, laundry, food } = req.body;
    const userId = req.user.id;

    // get listing and owner
    const listingRow = await db.oneOrNone('SELECT price, owner_id FROM listings WHERE id=$1', [listingId]);
    if (!listingRow) {
      req.flash('error', 'Listing not found');
      return res.redirect('/listings');
    }

    // prevent owner booking their own listing
    if (listingRow.owner_id === userId) {
      req.flash('error', 'You cannot book your own listing.');
      return res.redirect(`/listings/${listingId}`);
    }

    const msInDay = 24 * 60 * 60 * 1000;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const nights = Math.max(1, Math.round(Math.abs(e - s) / msInDay));
    let total = listingRow ? parseFloat(listingRow.price) * nights : 0;

    const services = [];
    if (laundry === 'on') {
      const laundryPrice = parseFloat(process.env.LAUNDRY_PRICE || '3000.00');
      total += laundryPrice;
      services.push({ type: 'laundry', price: laundryPrice });
    }
    if (food === 'on') {
      const foodPrice = parseFloat(process.env.FOOD_PRICE || '2000.00');
      total += foodPrice;
      services.push({ type: 'food', price: foodPrice });
    }

    const booking = await db.one(
      'INSERT INTO bookings(listing_id, user_id, start_date, end_date, total_price, paid, laundry_requested, created_at) VALUES($1,$2,$3,$4,$5,false,$6,now()) RETURNING id',
      [listingId, userId, startDate || null, endDate || null, total, (laundry === 'on')]
    );

    for (const sItem of services) {
      await db.none('INSERT INTO booking_services(booking_id, service_type, provider_id, price, created_at) VALUES($1,$2,$3,$4,now())', [booking.id, sItem.type, null, sItem.price]);
    }

    // For the stub: redirect to verify page (or provider)
    return res.redirect(`/payments/verify`); // or respond JSON if you prefer an API flow
  } catch (err) {
    console.error('payments.initiate error', err);
    req.flash('error', 'Unable to initiate payment');
    return res.redirect('/listings');
  }
};

// POST /payments/verify (changed to POST per your requirement)
exports.verify = async (req, res) => {
  try {
    const { bookingId, status } = req.body;
    if (!bookingId) return res.status(400).send('Missing bookingId');
    if (status === 'success') {
      await db.none('UPDATE bookings SET paid=true WHERE id=$1', [bookingId]);
      return res.send('Payment verified (stub). Booking marked paid.');
    }
    return res.send('Payment failed/cancelled (stub).');
  } catch (err) {
    console.error('payments.verify error', err);
    return res.status(500).send('Error verifying payment');
  }
};

// POST /payments/webhook
exports.webhook = async (req, res) => {
  console.log('Payment webhook received', req.body);
  // validate signature in production
  res.status(200).send('OK');
};

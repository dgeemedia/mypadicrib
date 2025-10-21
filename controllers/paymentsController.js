// controllers/paymentsController.js
const fetch = global.fetch || require('node-fetch');
const crypto = require('crypto');
const db = require('../models/db');
const listingModel = require('../models/listingModel');
const messageModel = require('../models/messageModel');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || null;
if (!PAYSTACK_SECRET) console.warn('PAYSTACK_SECRET_KEY missing from env (paystack integration will be limited)');

/**
 * Helper: verify a Paystack transaction server-side (recommended).
 * Returns the Paystack transaction `data` object on success.
 */
async function verifyTransaction(reference) {
  if (!PAYSTACK_SECRET) throw new Error('PAYSTACK_SECRET_KEY not configured');
  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json'
    }
  });
  const json = await res.json();
  if (!json || !json.status) {
    throw new Error('Paystack verification failed: ' + JSON.stringify(json));
  }
  return json.data; // contains transaction details
}

/**
 * GET /payments/checkout?listingId=...
 * Generic checkout form used for booking or listing-fee flows.
 * Loads providers so user can choose.
 */
exports.checkoutForm = async (req, res) => {
  try {
    const listingId = req.query.listingId ? Number(req.query.listingId) : null;
    let listing = null;

    if (listingId) {
      const data = await listingModel.getListingById(listingId);
      listing = data && data.listing ? data.listing : null;
    }

    // load providers for optional services
    const laundryProviders = await db.manyOrNone('SELECT id, name, phone, email FROM laundry_providers ORDER BY name');
    const foodVendors = await db.manyOrNone('SELECT id, name, phone, email FROM food_vendors ORDER BY name');

    return res.render('payments/checkout', {
      listingId,
      listing,
      user: req.user,
      laundryProviders,
      foodVendors,
      laundryPrice: parseFloat(process.env.LAUNDRY_PRICE || '3000.00'),
      foodPrice: parseFloat(process.env.FOOD_PRICE || '2000.00')
    });
  } catch (err) {
    console.error('checkoutForm error', err);
    req.flash('error', 'Unable to load payment form');
    return res.redirect('/listings');
  }
};

/**
 * GET /payments/listing-fee?listingId=...
 * Listing fee / renewal form (owner-facing).
 */
exports.listingFeeForm = async (req, res) => {
  try {
    const listingId = req.query.listingId ? Number(req.query.listingId) : null;
    let listing = null;

    if (listingId) {
      const data = await listingModel.getListingById(listingId);
      listing = data && data.listing ? data.listing : null;
    }

    return res.render('payments/checkout', { listingId, listing, user: req.user });
  } catch (err) {
    console.error('listingFeeForm error', err);
    req.flash('error', 'Unable to load payment form');
    return res.redirect('/owner/dashboard');
  }
};

/**
 * POST /payments/listing-fee/pay (stub)
 * For quick local testing: marks listing paid and sets paid_until.
 */
exports.payListingFeeStub = async (req, res) => {
  try {
    const listingId = Number(req.body.listingId);
    const period = req.body.period === 'yearly' ? 'yearly' : 'monthly';
    if (!listingId) {
      req.flash('error', 'Missing listing id');
      return res.redirect('/owner/dashboard');
    }

    // get amount from listing row if present, otherwise use env fallback
    const row = await db.oneOrNone('SELECT listing_fee_amount, owner_id, title FROM listings WHERE id=$1', [listingId]);
    if (!row) {
      req.flash('error', 'Listing not found');
      return res.redirect('/owner/dashboard');
    }

    const amount = row.listing_fee_amount ? parseFloat(row.listing_fee_amount) : parseFloat(process.env.LISTING_FEE || '5000.00');

    // simulate success: mark paid and set paid_until starting now
    await listingModel.setListingPaidUntil(listingId, {
      period,
      amount,
      invoiceRef: `manual-${Date.now()}`,
      startsAt: new Date()
    });

    // optionally notify owner
    try {
      const conv = await messageModel.createConversation({
        subject: `Listing #${listingId} payment (manual)`,
        memberIds: [row.owner_id]
      }).catch(() => null);

      if (conv) {
        await messageModel.addMessage({
          conversation_id: conv.id,
          sender_id: row.owner_id,
          body: `Manual payment recorded for your listing "${row.title}". It's now paid (period: ${period}).`
        }).catch(() => null);
      }
    } catch (e) {
      console.warn('payListingFeeStub: notify failed', e);
    }

    req.flash('success', `Listing fee paid (stub). Listing renewed for ${period}.`);
    return res.redirect('/owner/dashboard');
  } catch (err) {
    console.error('payListingFeeStub error', err);
    req.flash('error', 'Could not process payment (stub).');
    return res.redirect('/owner/dashboard');
  }
};

/**
 * POST /payments/initiate  (booking payments)
 * Creates a booking (paid=false) and returns redirect to verification / payment step.
 * Accepts laundry_provider_id and food_provider_id (optional).
 */
exports.initiate = async (req, res) => {
  try {
    const { listingId, startDate, endDate, laundry, food, laundry_provider_id, food_provider_id } = req.body;
    const userId = req.user && req.user.id;
    if (!userId) {
      req.flash('error', 'You must be logged in to book a listing');
      return res.redirect('/auth/login');
    }

    // validate listing
    const data = await listingModel.getListingById(Number(listingId));
    const listing = data && data.listing;
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/listings');
    }

    // ensure listing is approved, active and not expired (if paid_until exists)
    const isApproved = listing.status === 'approved';
    const isActive = listing.is_active === true;
    const paidUntil = listing.paid_until ? new Date(listing.paid_until) : null;
    const notExpired = !paidUntil || paidUntil > new Date();

    if (!isApproved || !isActive || !notExpired) {
      req.flash('error', 'Listing is not available for booking');
      return res.redirect(`/listings/${listingId}`);
    }

    // prevent owner booking their own listing
    if (listing.owner_id === userId) {
      req.flash('error', 'You cannot book your own listing.');
      return res.redirect(`/listings/${listingId}`);
    }

    // calculate nights and base total
    const msInDay = 24 * 60 * 60 * 1000;
    const s = startDate ? new Date(startDate) : new Date();
    const e = endDate ? new Date(endDate) : new Date(s.getTime() + msInDay);
    const nights = Math.max(1, Math.round(Math.abs(e - s) / msInDay));
    let total = listing ? parseFloat(listing.price) * nights : 0;

    // services details to persist into booking_services
    const services = [];

    // Laundry: if selected, attach price and provider_id
    if (laundry === 'on' || laundry_provider_id) {
      let laundryPrice = parseFloat(process.env.LAUNDRY_PRICE || '3000.00');
      let providerId = laundry_provider_id ? Number(laundry_provider_id) : null;

      // optionally fetch provider-specific price if you add price column
      // if (providerId) { const prov = await db.oneOrNone('SELECT price FROM laundry_providers WHERE id=$1', [providerId]); if (prov && prov.price) laundryPrice = parseFloat(prov.price); }

      total += laundryPrice;
      services.push({ type: 'laundry', price: laundryPrice, provider_id: providerId });
    }

    // Food: same as laundry
    if (food === 'on' || food_provider_id) {
      let foodPrice = parseFloat(process.env.FOOD_PRICE || '2000.00');
      let providerId = food_provider_id ? Number(food_provider_id) : null;

      // optionally fetch provider-specific price here

      total += foodPrice;
      services.push({ type: 'food', price: foodPrice, provider_id: providerId });
    }

    // create booking (paid=false initially)
    const booking = await db.one(
      'INSERT INTO bookings(listing_id, user_id, start_date, end_date, total_price, paid, laundry_requested, created_at) VALUES($1,$2,$3,$4,$5,false,$6,now()) RETURNING id',
      [listingId, userId, startDate || null, endDate || null, total, (services.some(s=>s.type==='laundry'))]
    );

    // persist booking services with provider assignment (provider_id may be null)
    for (const sItem of services) {
      await db.none(
        'INSERT INTO booking_services(booking_id, service_type, provider_id, price, created_at) VALUES($1,$2,$3,$4,now())',
        [booking.id, sItem.type, sItem.provider_id, sItem.price]
      );
    }

    // Redirect to verification/checkout page with booking id (frontend will call payment provider)
    return res.redirect(`/payments/verify?bookingId=${booking.id}`);
  } catch (err) {
    console.error('payments.initiate error', err);
    req.flash('error', 'Unable to initiate payment');
    return res.redirect('/listings');
  }
};

/**
 * POST /payments/verify
 * Stub endpoint to mark a booking paid after provider callback or manual verification.
 */
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

/**
 * Generic webhook endpoint for payment provider events.
 * POST /payments/webhook
 */
exports.webhook = async (req, res) => {
  try {
    console.log('Payment webhook received', req.body);
    // validate signature in production if necessary
    res.status(200).send('OK');
  } catch (err) {
    console.error('payments.webhook error', err);
    res.status(500).send('error');
  }
};

/**
 * Initiate Paystack transaction for a listing fee (owner renewal or first-time).
 * POST /payments/listing-initiate
 * Body: listingId, period
 */
exports.initiateListingPayment = async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      req.flash('error', 'Payment provider not configured');
      return res.redirect('/owner/dashboard');
    }

    const { listingId, period = 'monthly' } = req.body;
    if (!listingId) return res.status(400).send('missing listingId');

    const data = await listingModel.getListingById(Number(listingId));
    const listing = data && data.listing;
    if (!listing) {
      req.flash('error', 'Listing not found');
      return res.redirect('/owner/dashboard');
    }

    const monthlyFee = parseFloat(process.env.LISTING_FEE_MONTHLY ?? process.env.LISTING_FEE ?? '5000.00');
    const yearlyFee = parseFloat(process.env.LISTING_FEE_YEARLY ?? String(monthlyFee * 12));
    const amountNaira = (period === 'yearly') ? yearlyFee : monthlyFee;
    const amountKobo = Math.round(amountNaira * 100);

    // owner's email
    const ownerRec = await db.oneOrNone('SELECT email FROM users WHERE id=$1', [listing.owner_id]);
    const email = (ownerRec && ownerRec.email) ? ownerRec.email : (req.user && req.user.email) || 'no-reply@yourdomain.com';

    const reference = `listing-${listingId}-${Date.now()}`;

    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        metadata: {
          listingId: Number(listingId),
          period
        }
        // optionally: callback_url: `${process.env.SITE_URL}/payments/listing-callback`
      })
    });

    const initJson = await initRes.json();
    if (!initJson || !initJson.status || !initJson.data || !initJson.data.authorization_url) {
      console.error('paystack init failed', initJson);
      req.flash('error', 'Unable to initiate payment provider');
      return res.redirect(`/owner/dashboard`);
    }

    return res.redirect(initJson.data.authorization_url);
  } catch (err) {
    console.error('initiateListingPayment error', err);
    req.flash('error', 'Could not start payment');
    return res.redirect('/owner/dashboard');
  }
};

/**
 * GET /payments/listing-callback?reference=...
 * This is the page Paystack can redirect the user to after payment.
 * It verifies the transaction and marks listing paid if successful.
 */
exports.listingCallback = async (req, res) => {
  try {
    const reference = req.query.reference || req.query.trxref || null;
    if (!reference) {
      req.flash('error', 'Missing payment reference');
      return res.redirect('/owner/dashboard');
    }

    // verify transaction with Paystack
    let tx;
    try {
      tx = await verifyTransaction(reference);
    } catch (err) {
      console.error('listingCallback verify error', err);
      req.flash('error', 'Could not verify payment with provider');
      return res.redirect('/owner/dashboard');
    }

    // Ensure success and metadata presence
    if (!tx || tx.status !== 'success') {
      req.flash('error', 'Payment not successful');
      return res.redirect('/owner/dashboard');
    }

    const metadata = tx.metadata || {};
    const listingId = metadata.listingId ? Number(metadata.listingId) : null;
    const period = metadata.period || 'monthly';
    const amountNaira = (tx.amount && !isNaN(tx.amount)) ? Number(tx.amount) / 100 : null; // paystack amount in kobo

    if (!listingId) {
      req.flash('error', 'Listing not present in transaction metadata');
      return res.redirect('/owner/dashboard');
    }

    // start from existing paid_until if in future, else now
    const row = await db.oneOrNone('SELECT paid_until, owner_id, title FROM listings WHERE id=$1', [listingId]);
    if (!row) {
      req.flash('error', 'Listing not found');
      return res.redirect('/owner/dashboard');
    }
    const existingPaidUntil = row.paid_until ? new Date(row.paid_until) : null;
    const now = new Date();
    const startsAt = (existingPaidUntil && existingPaidUntil > now) ? existingPaidUntil : now;

    // mark listing paid
    const updated = await listingModel.setListingPaidUntil(listingId, {
      period,
      amount: amountNaira || undefined,
      invoiceRef: reference,
      startsAt
    });

    req.flash('success', `Payment received. Listing renewed until ${new Date(updated.paid_until).toLocaleString()}`);
    return res.redirect('/owner/dashboard');
  } catch (err) {
    console.error('listingCallback unexpected error', err);
    req.flash('error', 'Server error during payment processing');
    return res.redirect('/owner/dashboard');
  }
};

/**
 * Listing fee webhook (server-to-server) — called by Paystack when owner pays listing fee / renewal.
 * Route: POST /payments/webhook (we handle paystack events here)
 * Validates x-paystack-signature header.
 */
exports.listingPaymentWebhook = async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      console.warn('listingPaymentWebhook called but PAYSTACK_SECRET not configured');
      return res.status(400).send('provider not configured');
    }

    const signature = req.headers['x-paystack-signature'];
    const bodyRaw = JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha512', PAYSTACK_SECRET).update(bodyRaw).digest('hex');

    if (!signature || signature !== expected) {
      console.warn('Invalid Paystack signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    if (!event || !event.event) return res.status(200).send('ignored');

    if (event.event === 'charge.success' && event.data) {
      const reference = event.data.reference;
      const metadata = event.data.metadata || {};
      const listingId = metadata.listingId ? Number(metadata.listingId) : null;
      const period = metadata.period || 'monthly';
      const amountKobo = Number(event.data.amount || 0);
      const amountNaira = amountKobo / 100;

      if (listingId) {
        const row = await db.oneOrNone('SELECT paid_until, owner_id, title FROM listings WHERE id=$1', [listingId]);
        if (!row) {
          console.warn('listingPaymentWebhook: listing not found', listingId);
          return res.status(404).send('Listing not found');
        }

        const existingPaidUntil = row.paid_until ? new Date(row.paid_until) : null;
        const now = new Date();
        const startsAt = (existingPaidUntil && existingPaidUntil > now) ? existingPaidUntil : now;

        const updated = await listingModel.setListingPaidUntil(listingId, {
          period,
          amount: amountNaira,
          invoiceRef: reference,
          startsAt
        });

        // notify owner (best-effort, non-blocking)
        try {
          if (row.owner_id) {
            const conv = await messageModel.createConversation({
              subject: `Listing #${listingId} payment received`,
              memberIds: [row.owner_id]
            }).catch(() => null);

            if (conv) {
              await messageModel.addMessage({
                conversation_id: conv.id,
                sender_id: row.owner_id,
                body: `Payment received for your listing "${row.title}". Listing is paid until ${new Date(updated.paid_until).toLocaleString()}.`
              }).catch(() => null);
            }
          }
        } catch (notifyErr) {
          console.warn('listingPaymentWebhook: notification error', notifyErr);
        }
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('ignored');
  } catch (err) {
    console.error('listing payment webhook error', err);
    return res.status(500).send('error');
  }
};

module.exports = exports;

-- PostgreSQL schema for mypadiCrib starter
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT,
  lga TEXT,
  address TEXT,
  price NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_images (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  total_price NUMERIC(12,2),
  paid BOOLEAN DEFAULT false,
  payment_ref TEXT,
  laundry_requested BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laundry_requests (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- database/migrations.sql

-- 1) User verification + role already exists; add is_verified
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 2) Add listing status and listing fee tracking
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending', -- pending | approved | rejected
  ADD COLUMN IF NOT EXISTS listing_fee_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS listing_fee_amount NUMERIC(10,2) DEFAULT 0.00;

-- 3) Create table to track listing fee payments (for owner listing payments)
CREATE TABLE IF NOT EXISTS listing_fees (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(10,2),
  paid BOOLEAN DEFAULT false,
  payment_ref TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- 4) Laundry providers and food vendors
CREATE TABLE IF NOT EXISTS laundry_providers (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_vendors (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- 5) Booking services (link booking -> service items like laundry, food)
CREATE TABLE IF NOT EXISTS booking_services (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  service_type TEXT, -- 'laundry' | 'food' | 'other'
  provider_id INTEGER, -- provider id from laundry_providers or food_vendors
  price NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT now()
);

-- 6) Allow owner -> limit logic: no DB column required since we count rows, but we'll create an index
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);

-- 7) Admin/staff roles are stored in users.role already. (role: 'user' | 'owner' | 'admin' | 'staff')

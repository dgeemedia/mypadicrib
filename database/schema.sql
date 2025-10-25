-- init_clean_mypadicrib.sql
-- Clean recreate for mypadicrib schema (listings/bookings/messages/etc.)
-- WARNING: This will DROP existing objects in public schema mentioned here.
-- Adjust owner names if needed before running.

-- ========== DROP objects (safe to re-run) ==========
DROP TABLE IF EXISTS public.booking_services CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.conversation_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.food_vendors CASCADE;
DROP TABLE IF EXISTS public.laundry_providers CASCADE;
DROP TABLE IF EXISTS public.laundry_requests CASCADE;
DROP TABLE IF EXISTS public.listing_actions CASCADE;
DROP TABLE IF EXISTS public.listing_fees CASCADE;
DROP TABLE IF EXISTS public.listing_images CASCADE;
DROP TABLE IF EXISTS public.listing_reminders CASCADE;
DROP TABLE IF EXISTS public.listing_verifications CASCADE;
DROP TABLE IF EXISTS public.listings CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.user_suspensions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.booking_services_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.bookings_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.conversation_members_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.conversations_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.food_vendors_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.laundry_providers_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.laundry_requests_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.listing_actions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.listing_fees_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.listing_images_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.listing_reminders_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.listing_verifications_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.listings_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.messages_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.reviews_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.user_suspensions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.users_id_seq CASCADE;

-- ========== Sequences ==========
CREATE SEQUENCE public.booking_services_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.booking_services_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.bookings_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.bookings_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.conversation_members_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.conversation_members_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.conversations_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.conversations_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.food_vendors_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.food_vendors_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.laundry_providers_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.laundry_providers_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.laundry_requests_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.laundry_requests_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.listing_actions_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.listing_actions_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.listing_fees_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.listing_fees_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.listing_images_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.listing_images_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.listing_reminders_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.listing_reminders_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.listing_verifications_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.listing_verifications_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.listings_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.listings_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.messages_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.messages_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.reviews_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.reviews_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.user_suspensions_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.user_suspensions_id_seq OWNER TO mypadicrib_user;

CREATE SEQUENCE public.users_id_seq
  AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNER TO mypadicrib_user;

-- ========== Tables ==========
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('public.users_id_seq'::regclass),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  password_hash text NOT NULL,
  role text DEFAULT 'user'::text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  is_verified boolean DEFAULT false,
  status text DEFAULT 'active'::text NOT NULL,
  suspended_until timestamp with time zone
);
ALTER TABLE public.users OWNER TO mypadicrib_user;

CREATE TABLE public.listings (
  id integer NOT NULL DEFAULT nextval('public.listings_id_seq'::regclass),
  owner_id integer,
  title text NOT NULL,
  description text,
  state text,
  lga text,
  address text,
  price numeric(12,2),
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  listing_fee_paid boolean DEFAULT false,
  listing_fee_amount numeric(10,2) DEFAULT 0.00,
  suspended_until timestamp with time zone,
  deleted_at timestamp with time zone,
  paid_until timestamp with time zone,
  payment_plan text
);
ALTER TABLE public.listings OWNER TO mypadicrib_user;

CREATE TABLE public.listing_verifications (
  id integer NOT NULL DEFAULT nextval('public.listing_verifications_id_seq'::regclass),
  listing_id integer,
  owner_id integer,
  selfie_path text,
  id_card_path text,
  id_number text,
  status character varying(20) DEFAULT 'pending'::character varying,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.listing_verifications OWNER TO mypadicrib_user;

CREATE TABLE public.listing_reminders (
  id integer NOT NULL DEFAULT nextval('public.listing_reminders_id_seq'::regclass),
  listing_id integer,
  reminder_type text,
  sent_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.listing_reminders OWNER TO mypadicrib_user;

CREATE TABLE public.listing_images (
  id integer NOT NULL DEFAULT nextval('public.listing_images_id_seq'::regclass),
  listing_id integer,
  image_path text NOT NULL
);
ALTER TABLE public.listing_images OWNER TO mypadicrib_user;

CREATE TABLE public.listing_fees (
  id integer NOT NULL DEFAULT nextval('public.listing_fees_id_seq'::regclass),
  listing_id integer,
  owner_id integer,
  amount numeric(10,2),
  paid boolean DEFAULT false,
  payment_ref text,
  created_at timestamp without time zone DEFAULT now(),
  period text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  paid_at timestamp with time zone,
  invoice_ref text
);
ALTER TABLE public.listing_fees OWNER TO mypadicrib_user;

CREATE TABLE public.listing_actions (
  id integer NOT NULL DEFAULT nextval('public.listing_actions_id_seq'::regclass),
  listing_id integer,
  admin_id integer,
  action text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.listing_actions OWNER TO mypadicrib_user;

CREATE TABLE public.laundry_requests (
  id integer NOT NULL DEFAULT nextval('public.laundry_requests_id_seq'::regclass),
  booking_id integer,
  status text DEFAULT 'pending'::text,
  requested_at timestamp without time zone DEFAULT now()
);
ALTER TABLE public.laundry_requests OWNER TO mypadicrib_user;

CREATE TABLE public.laundry_providers (
  id integer NOT NULL DEFAULT nextval('public.laundry_providers_id_seq'::regclass),
  name text,
  phone text,
  email text,
  active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  price numeric
);
ALTER TABLE public.laundry_providers OWNER TO mypadicrib_user;

CREATE TABLE public.food_vendors (
  id integer NOT NULL DEFAULT nextval('public.food_vendors_id_seq'::regclass),
  name text,
  phone text,
  email text,
  active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  price numeric
);
ALTER TABLE public.food_vendors OWNER TO mypadicrib_user;

CREATE TABLE public.conversations (
  id integer NOT NULL DEFAULT nextval('public.conversations_id_seq'::regclass),
  subject text,
  created_at timestamp without time zone DEFAULT now(),
  last_message_at timestamp without time zone DEFAULT now()
);
ALTER TABLE public.conversations OWNER TO mypadicrib_user;

CREATE TABLE public.conversation_members (
  id integer NOT NULL DEFAULT nextval('public.conversation_members_id_seq'::regclass),
  conversation_id integer,
  user_id integer
);
ALTER TABLE public.conversation_members OWNER TO mypadicrib_user;

CREATE TABLE public.messages (
  id integer NOT NULL DEFAULT nextval('public.messages_id_seq'::regclass),
  conversation_id integer,
  sender_id integer,
  body text NOT NULL,
  read_by jsonb DEFAULT '[]'::jsonb,
  created_at timestamp without time zone DEFAULT now()
);
ALTER TABLE public.messages OWNER TO mypadicrib_user;

CREATE TABLE public.bookings (
  id integer NOT NULL DEFAULT nextval('public.bookings_id_seq'::regclass),
  listing_id integer,
  user_id integer,
  start_date date,
  end_date date,
  total_price numeric(12,2),
  paid boolean DEFAULT false,
  payment_ref text,
  laundry_requested boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now()
);
ALTER TABLE public.bookings OWNER TO mypadicrib_user;

CREATE TABLE public.booking_services (
  id integer NOT NULL DEFAULT nextval('public.booking_services_id_seq'::regclass),
  booking_id integer,
  service_type text,
  provider_id integer,
  price numeric(10,2),
  created_at timestamp without time zone DEFAULT now()
);
ALTER TABLE public.booking_services OWNER TO mypadicrib_user;

CREATE TABLE public.reviews (
  id integer NOT NULL DEFAULT nextval('public.reviews_id_seq'::regclass),
  listing_id integer,
  user_id integer,
  rating integer,
  comment text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  parent_id integer,
  CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
ALTER TABLE public.reviews OWNER TO mypadicrib_user;

CREATE TABLE public.user_suspensions (
  id integer NOT NULL DEFAULT nextval('public.user_suspensions_id_seq'::regclass),
  user_id integer,
  admin_id integer,
  action text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.user_suspensions OWNER TO mypadicrib_user;

-- ========== Primary keys and uniques ==========
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.listings ADD CONSTRAINT listings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.listing_verifications ADD CONSTRAINT listing_verifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.listing_reminders ADD CONSTRAINT listing_reminders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.listing_images ADD CONSTRAINT listing_images_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.listing_fees ADD CONSTRAINT listing_fees_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.listing_actions ADD CONSTRAINT listing_actions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.laundry_requests ADD CONSTRAINT laundry_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.laundry_providers ADD CONSTRAINT laundry_providers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.food_vendors ADD CONSTRAINT food_vendors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conversation_members ADD CONSTRAINT conversation_members_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.booking_services ADD CONSTRAINT booking_services_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_suspensions ADD CONSTRAINT user_suspensions_pkey PRIMARY KEY (id);

-- ========== Indexes ==========
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON public.conversation_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_listing_fees_listing_id ON public.listing_fees USING btree (listing_id);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON public.listings USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_paid_until ON public.listings USING btree (paid_until);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS users_status_idx ON public.users USING btree (status);

-- ========== Foreign keys ==========
ALTER TABLE ONLY public.booking_services
  ADD CONSTRAINT booking_services_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.bookings
  ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.conversation_members
  ADD CONSTRAINT conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_members
  ADD CONSTRAINT conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.laundry_requests
  ADD CONSTRAINT laundry_requests_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.listing_actions
  ADD CONSTRAINT listing_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.listing_actions
  ADD CONSTRAINT listing_actions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.listing_fees
  ADD CONSTRAINT listing_fees_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.listing_fees
  ADD CONSTRAINT listing_fees_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.listing_images
  ADD CONSTRAINT listing_images_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.listing_reminders
  ADD CONSTRAINT listing_reminders_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.listing_verifications
  ADD CONSTRAINT listing_verifications_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.listing_verifications
  ADD CONSTRAINT listing_verifications_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.listings
  ADD CONSTRAINT listings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.messages
  ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.messages
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reviews
  ADD CONSTRAINT reviews_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reviews
  ADD CONSTRAINT reviews_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.reviews(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reviews
  ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_suspensions
  ADD CONSTRAINT user_suspensions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_suspensions
  ADD CONSTRAINT user_suspensions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ========== Final notes ==========
-- This script intentionally omits data copying (COPY) and sequence setval adjustments.
-- After running, create necessary initial admin/users via your app or a separate seed script.
-- If your DB user differs from mypadicrib_user, edit ALTER ... OWNER TO lines accordingly.

-- End of init_clean_mypadicrib.sql




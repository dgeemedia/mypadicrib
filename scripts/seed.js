/**
 * Seed script for mypadiCrib starter (uses pg-promise).
 * Usage: pnpm run seed
 */

require('dotenv').config();
const pgp = require('pg-promise')();
const cn = process.env.DATABASE_URL;
const db = pgp(cn);

async function run() {
  try {
    console.log('Running seeds...');
    const fs = require('fs');
    const sql = fs.readFileSync('./database/schema.sql', 'utf8');
    await db.none(sql);
    // sample users (password_hash placeholders)
    await db.none("INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES('Alice Owner','alice@example.com','08011111111','$2b$10$placeholder1','user',now()) ON CONFLICT (email) DO NOTHING");
    await db.none("INSERT INTO users(name,email,phone,password_hash,role,created_at) VALUES('Bob Traveller','bob@example.com','08022222222','$2b$10$placeholder2','user',now()) ON CONFLICT (email) DO NOTHING");
    // sample listing
    const exists = await db.oneOrNone("SELECT id FROM listings WHERE title='Cozy 2BR in Ikeja'")
    if (!exists) {
      const l = await db.one("INSERT INTO listings(owner_id, title, description, state, lga, address, price, is_active, created_at) VALUES(1,$1,$2,$3,$4,$5,$6,true,now()) RETURNING id", ['Cozy 2BR in Ikeja','A comfortable 2-bedroom shortlet close to amenities','Lagos','Ikeja','12 Example St, Ikeja', 15000.00]);
      await db.none("INSERT INTO listing_images(listing_id, image_path) VALUES($1,$2)", [l.id, '/uploads/sample1.jpg']);
      await db.none("INSERT INTO listing_images(listing_id, image_path) VALUES($1,$2)", [l.id, '/uploads/sample2.jpg']);
    }
    // review
    await db.none("INSERT INTO reviews(listing_id,user_id,rating,comment,created_at) VALUES(1,2,5,'Very comfortable and clean', now()) ON CONFLICT DO NOTHING");
    // booking
    await db.none("INSERT INTO bookings(listing_id,user_id,start_date,end_date,total_price,paid,laundry_requested,created_at) VALUES(1,2,'2025-11-01','2025-11-05',60000,false,false,now()) ON CONFLICT DO NOTHING");
    console.log('Seeds completed. Add real password hashes and sample images into /uploads if needed.');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}
run();

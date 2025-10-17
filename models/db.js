// models/db.js
const initOptions = {};
const pgp = require('pg-promise')(initOptions);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

// Support SSL for hosts that require it (Render / Heroku)
const cn = {
  connectionString,
  // use TLS but skip certificate verification for many hosted providers
  // If your provider demands stricter verification, remove rejectUnauthorized:false and set up CA certs.
  ssl: { rejectUnauthorized: false }
};

const db = pgp(cn);

(async () => {
  try {
    await db.connect(); // will throw if connection fails
    console.log('Connected to Postgres');
  } catch (err) {
    console.error('ERROR connecting to Postgres:', err.message || err);
    // don't crash the process here if you want to keep the server up — but for dev it's helpful to stop
  }
})();

module.exports = db;

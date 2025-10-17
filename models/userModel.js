// models/userModel.js
const db = require('./db');

async function createUser({ name, email, phone, password_hash, role = 'user' }) {
  const q = `INSERT INTO users(name,email,phone,password_hash,role,created_at)
             VALUES($1,$2,$3,$4,$5,now()) RETURNING id, name, email, phone, role`;
  return db.one(q, [name,email,phone,password_hash,role]);
}

async function findByEmail(email) {
  return db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
}

async function findById(id) {
  return db.oneOrNone('SELECT id, name, email, phone, role FROM users WHERE id=$1', [id]);
}

module.exports = { createUser, findByEmail, findById };

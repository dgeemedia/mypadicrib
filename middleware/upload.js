// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');         // public listing images
const SECURE_DIR = path.join(process.cwd(), 'secure_uploads'); // private verification files

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(SECURE_DIR)) fs.mkdirSync(SECURE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'selfie' || file.fieldname === 'id_card') {
      cb(null, SECURE_DIR);
    } else {
      cb(null, UPLOAD_DIR);
    }
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random()*1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const maxMb = parseFloat(process.env.MAX_IMAGE_MB || '5'); // default 5 MB
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Only image files are allowed!'), false);
  } else {
    cb(null, true);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: Math.round(maxMb * 1024 * 1024) } });
module.exports = upload;

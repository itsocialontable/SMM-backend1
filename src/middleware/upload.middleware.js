const multer = require("multer");
const path   = require("path");
const os     = require("os");
const fs     = require("fs");

// ================= DISK STORAGE =================
// File pehle OS temp folder mein save hoti hai → Cloudinary jaati hai → delete hoti hai
// RAM pe zero load — chahe 100MB file ho
const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, os.tmpdir()); // /tmp on Linux — already exists, no setup needed
  },

  filename: (req, file, cb) => {
    // Unique naam: timestamp + random 6 chars + original extension
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext    = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  }

});

// ================= ALLOWED FILE TYPES =================
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  // Videos — original voice/audio intact rehti hai
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mpeg",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
];

// ================= FILE FILTER =================
const fileFilter = (req, file, cb) => {
  console.log("📁 MULTER FILE =>", file.originalname, file.mimetype);
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

// ================= MULTER INSTANCE =================
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // ✅ 100MB per file (pehle 50MB tha)
    files: 10
  }
});

// ================= CLEANUP HELPER =================
// Cloudinary upload ke baad temp files disk se delete karo
const cleanupTempFiles = (files = []) => {
  if (!files || files.length === 0) return;
  for (const file of files) {
    if (file.path) {
      fs.unlink(file.path, (err) => {
        if (err) console.warn("⚠️ Temp file delete failed:", file.path, err.message);
        else     console.log("🗑️ Temp file deleted:", file.path);
      });
    }
  }
};

module.exports = upload;
module.exports.cleanupTempFiles = cleanupTempFiles;

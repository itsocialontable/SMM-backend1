// ==========================================
// FILE: src/config/db.js
// FIXED v18: MONGO_URI (password ke saath) console.log ho raha tha —
//   production logs me credentials leak ho sakte the. Hata diya.
// ==========================================

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log("✅ DB connected");
  } catch (error) {
    console.error("❌ MongoDB Error:");
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
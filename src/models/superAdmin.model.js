// ==========================================
// FILE: src/models/superAdmin.model.js
// ==========================================

const mongoose = require("mongoose");

const superAdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      default: "superadmin"
    },

    // ================= FORGOT PASSWORD =================

    resetOtp: {
      type: String,
      default: null
    },

    resetOtpExpire: {
      type: Date,
      default: null
    },

    resetOtpVerified: {
      type: Boolean,
      default: false
    }

  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);

// ==========================================
// FILE: src/models/workspace.model.js
// UPDATED v18: admin (Admin model) ki jagah agency (Agency model) —
//              Admin model hata diya gaya, Agency hi sab kuch karti hai
// ==========================================

const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    // ================= AGENCY REFERENCE =================
    // Ek agency ka ek hi workspace hoga
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      unique: true
    },

    // ================= AGENCY / COMPANY INFO =================

    agencyName: {
      type: String,
      default: ""
    },

    agencyLogo: {
      type: String,
      default: null        // Cloudinary secure_url
    },

    agencyLogoPublicId: {
      type: String,
      default: null        // Cloudinary public_id
    },

    agencyWebsite: {
      type: String,
      default: ""
    },

    agencyEmail: {
      type: String,
      default: ""
    },

    agencyPhone: {
      type: String,
      default: ""
    },

    agencyAddress: {
      type: String,
      default: ""
    },

    // ================= TIMEZONE =================
    // Posts is timezone se schedule honge

    timezone: {
      type: String,
      default: "Asia/Kolkata"   // IST default
    },

    // ================= DEFAULT PLATFORMS =================
    // Post create karte waqt ye platforms pre-selected honge

    defaultPlatforms: {
      type: [String],
      enum: ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube"],
      default: ["instagram", "facebook"]
    },

    // ================= BUSINESS HOURS =================
    // Support / active hours

    businessHours: {
      start: { type: String, default: "09:00" },  // 24hr format
      end:   { type: String, default: "18:00" },
      days:  {
        type: [String],
        enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        default: ["monday", "tuesday", "wednesday", "thursday", "friday"]
      }
    },

    // ================= NOTIFICATION PREFERENCES =================

    notifications: {
      emailOnPostPublished:  { type: Boolean, default: true },
      emailOnPostFailed:     { type: Boolean, default: true },
      emailOnNewUser:        { type: Boolean, default: true },
      emailOnUserDeleted:    { type: Boolean, default: false }
    },

    // ================= BRANDING =================
    // Frontend app ka color theme

    branding: {
      primaryColor: { type: String, default: "#6366f1" },   // indigo
      accentColor:  { type: String, default: "#8b5cf6" }    // violet
    }

  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Workspace", workspaceSchema);

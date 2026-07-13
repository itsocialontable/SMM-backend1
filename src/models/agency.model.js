// ==========================================
// FILE: src/models/agency.model.js
// UPDATED v16: Subscription + Branding fields added
// ==========================================

const mongoose = require("mongoose");

const agencySchema = new mongoose.Schema(
  {
    // ================= BASIC INFO =================

    name: { type: String, required: true, trim: true },
    owner: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },

    // ================= IDENTITY DOCS =================

    aadharCard: { type: String, default: "" },
    panCard:    { type: String, default: "" },

    // ================= CONTACT / LOCATION =================

    phoneNumber:         { type: String, default: "" },
    websiteOrSocialLink: { type: String, default: "" },
    state:   { type: String, default: "" },
    city:    { type: String, default: "" },
    country: { type: String, default: "" },

    // ================= STATUS =================

    isActive: { type: Boolean, default: true },

    // ================= LOGIN SOURCE =================
    // Tracks whether agency logged in from web or app
    loginSource: {
      type: String,
      enum: ["web", "app"],
      default: "web"
    },

    // ================= PROFILE IMAGE (v18) =================
    // Agency ka apna owner/profile photo — Admin model hata diya gaya,
    // Agency hi ab "admin" hai aur sab kuch khud karti hai
    profileImage: {
      type: String,
      default: null        // Cloudinary secure_url
    },

    profileImagePublicId: {
      type: String,
      default: null        // Cloudinary public_id — delete ke liye zaroori
    },

    // ================= FORGOT PASSWORD (v18) =================
    // Pehle Admin model me tha — ab Agency khud apna password reset kar sakti hai
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
    },

    // ================= SUBSCRIPTION (NEW v16) =================

    trialStartDate:    { type: Date, default: null },
    trialEndDate:      { type: Date, default: null },
    subscriptionStatus: {
      type: String,
      enum: ["trial", "active", "expired"],
      default: "trial"
    },
    planType: {
      type: String,
      enum: ["trial", "basic", "pro", "enterprise"],
      default: "trial"
    },
    subscriptionExpiry: { type: Date, default: null },

    // ================= BRANDING (NEW v16) =================

    branding: {
      companyLogo:        { type: String, default: "" },   // Cloudinary URL
      companyLogoPublicId:{ type: String, default: "" },   // Cloudinary public_id
      companyDescription: { type: String, default: "", maxlength: 1000 },
      websiteUrl:         { type: String, default: "" },
      socialLinks: {
        facebook:  { type: String, default: "" },
        instagram: { type: String, default: "" },
        twitter:   { type: String, default: "" },
        linkedin:  { type: String, default: "" },
        youtube:   { type: String, default: "" }
      }
    }
  },
  { timestamps: true }
);

// Virtual: is trial active right now?
agencySchema.virtual("isTrialActive").get(function () {
  if (this.subscriptionStatus !== "trial") return false;
  return this.trialEndDate ? new Date() <= this.trialEndDate : false;
});

// Virtual: is subscription active (paid)?
agencySchema.virtual("isSubscriptionActive").get(function () {
  if (this.subscriptionStatus !== "active") return false;
  return this.subscriptionExpiry ? new Date() <= this.subscriptionExpiry : false;
});

agencySchema.set("toJSON",   { virtuals: true });
agencySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Agency", agencySchema);

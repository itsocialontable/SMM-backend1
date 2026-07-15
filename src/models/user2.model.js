// ==========================================
// FILE: src/models/user2.model.js
// UPDATED: Added deletedAt field for soft delete support
//          isActive: false = deleted/deactivated — login blocked
// ==========================================

const mongoose = require("mongoose");

const userSchema2 = new mongoose.Schema(
  {
    // ================= COMMON FIELDS =================

    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["Client", "SMM", "Graphic Designer"],
      required: true
    },

    profileImage: { type: String, default: "" },
    phoneNumber:  { type: String, default: "" },

    // ================= AGENCY SCOPING =================
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null
    },

    // ================= CLIENT FIELDS =================

    companyName: { type: String, default: "" },
    industry:    { type: String, default: "" },
    budget:      { type: Number, default: 0 },

    serviceKey:   { type: String, default: "" },
    gstNumber:    { type: String, default: "" },
    address:      { type: String, default: "" },
    projectTitle: { type: String, default: "" },
    duration:     { type: String, default: "" },
    description:  { type: String, default: "" },

    // v20: client "Connected Devices" preference — kaunse platforms
    // client use karna chahta hai (UI ke "Connected Devices" chips se
    // aata hai). Ye sirf admin/SMM ka intent/preference record hai,
    // actual OAuth connection SocialAccount model me alag se hoti hai.
    connectedDevices: {
      type: [String],
      enum: ["youtube", "pinterest", "twitter", "facebook", "instagram", "threads"],
      default: []
    },

    smmList: [{ type: mongoose.Schema.Types.ObjectId, ref: "User2" }],
    gdList:  [{ type: mongoose.Schema.Types.ObjectId, ref: "User2" }],

    // ================= SMM + GD FIELDS =================

    experience:  { type: String, default: "" },
    skills:      { type: [String], default: [] },
    platforms:   { type: [String], default: [] },

    // ================= GRAPHIC DESIGNER FIELDS =================

    specialization: { type: [String], default: [] },

    // ================= LOGIN SOURCE =================
    loginSource: {
      type: String,
      enum: ["web", "app"],
      default: "web"
    },

    createdByAdmin: { type: Boolean, default: true },

    // ✅ isActive: false means user is deleted OR deactivated — login will be blocked
    isActive: { type: Boolean, default: true },

    // ✅ deletedAt: set when soft-deleted
    deletedAt: { type: Date, default: null },

    // OTP fields (for password reset)
    resetOtp:             { type: String, default: null },
    resetOtpExpiry:       { type: Date,   default: null },
    resetOtpVerifiedAt:   { type: Date,   default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User2", userSchema2);

// ==========================================
// FILE: src/models/socialAccount.model.js
// UPDATED v18:
//   - ref "User" -> "User2" fix (User model kabhi exist nahi karta tha)
//   - "pinterest" platform enum me missing tha — add kiya (warna
//     Pinterest account connect karte waqt validation error aata tha)
//   - ownerType + dynamic refPath add kiya taaki Agency (apna khud ka
//     account, bina SMM ke) bhi connect kar sake, User2 (SMM) ki tarah
// ==========================================

const mongoose = require("mongoose");

const socialAccountSchema = new mongoose.Schema(
  {
    // Account kisne connect kiya — SMM (User2) ya khud Agency
    ownerType: {
      type: String,
      enum: ["User2", "Agency"],
      default: "User2",
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "ownerType",
      required: true,
      index: true,
    },

    // ─── Multi-client support ───────────────────────────────────────
    // Jab SMM kisi client ke liye account connect karta hai,
    // toh yahan client ka ID save hota hai.
    // null = SMM/Agency ka apna personal account
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User2",
      default: null,
      index: true,
    },

    platform: {
      type: String,
      enum: ["instagram", "youtube", "linkedin", "twitter", "facebook", "pinterest"],
      required: true,
      index: true,
    },

    accountName: {
      type: String,
      trim: true,
      default: "Unknown Account",
    },

    accountId: {
      type: String,
      required: true,
    },

    accessToken: {
      type: String,
      // required: true,
      required: false, default: "",
      select: false,
    },

    refreshToken: {
      type: String,
      select: false,
    },

    profileImage: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    tokenExpiresAt: {
      type: Date,
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    lastSyncAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);


socialAccountSchema.index(
  { user: 1, platform: 1, accountId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      accountId: { $exists: true, $ne: null },
    },
  }
);

module.exports = mongoose.model("SocialAccount", socialAccountSchema);

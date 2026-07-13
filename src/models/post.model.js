// ==========================================
// FILE: src/models/post.model.js
// UPDATED v18:
//   - ref "User" -> "User2" (User model never existed, ye fix kar diya)
//   - pinterestBoardId field added (real Pinterest publish ke liye)
//   - purana dead/commented code clean kar diya
// ==========================================

const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User2",
      required: true
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User2",
      default: null
    },

    content: {
      type: String,
      required: true,
      trim: true
    },

    media: [
      {
        url:       { type: String, required: true },
        public_id: { type: String },
        type: {
          type: String,
          enum: ["image", "video", "raw", "file"],
          default: "image"
        },
        format: { type: String },
        bytes:  { type: Number }
      }
    ],

    platforms: { type: [String], required: true },
    tags:       { type: [String], default: [] },

    // ---- YouTube-specific fields ----
    // YouTube pe video title alag hota hai — caption nahi chalti
    youtubeTitle:   { type: String, default: null },
    // public / private / unlisted
    youtubePrivacy: { type: String, enum: ["public", "private", "unlisted"], default: "public" },

    // ---- Pinterest-specific field (v18) ----
    // Pinterest pe pin kisi board ke andar hona zaroori hai.
    // Agar nahi diya, worker user ka pehla board fetch karke use karega.
    pinterestBoardId: { type: String, default: null },

    // ---- Primary scheduled datetime (ISO string or Date) ----
    scheduleAt: { type: Date, default: null },

    // ---- v16 FIX: frontend sends these separately ----
    scheduleDate: { type: String, default: null },  // "YYYY-MM-DD"
    scheduleTime: { type: String, default: null },  // "HH:mm"

    status: {
      type: String,
      enum: ["draft", "queued", "scheduled", "published", "failed"],
      default: "draft"
    },

    results: [
      {
        platform: String,
        status:   String,
        postId:   String,
        error:    String,
        url:      String
      }
    ],

    publishedAt:    Date,
    platformPostId: { type: String, default: null },

    // ---- v19: publish lock (race-condition fix) ----
    // Worker (BullMQ) aur cron recovery job dono same post ko parallel
    // process karne ki koshish kar sakte the (e.g. slow YouTube upload
    // jo 2min cron grace period se zyada le le). Isse atomic claim
    // hota hai — sirf ek hi caller ek time pe post process kar sakta
    // hai. Stale lock (crashed process) TIMEOUT ke baad dobara claim
    // ho sakta hai — dekho postPublish.service.js.
    processingLockedAt: { type: Date, default: null },

    // ================= ANALYTICS =================
    likes:    { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares:   { type: Number, default: 0 },
    views:    { type: Number, default: 0 },

    analyticsSource: {
      type: String,
      enum: ["mock", "real"],
      default: "mock"
    }
  },
  { timestamps: true }
);

postSchema.index({ user: 1, status: 1 });
postSchema.index({ scheduleAt: 1 });

module.exports = mongoose.model("Post", postSchema);

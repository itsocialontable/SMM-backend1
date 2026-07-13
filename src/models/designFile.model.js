// ==========================================
// FILE: src/models/designFile.model.js
// ==========================================

const mongoose = require("mongoose");

const designFileSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DesignProject",
      required: true,
      index: true
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User2",
      required: true
    },

    // ---- File Info ----
    fileName: {
      type: String,
      required: true,
      trim: true
    },

    fileUrl: {
      type: String,
      required: true       // Cloudinary secure_url
    },

    filePublicId: {
      type: String,
      required: true       // Cloudinary public_id
    },

    fileFormat: {
      type: String          // jpg, png, pdf, psd, ai, zip
    },

    fileSize: {
      type: Number          // bytes
    },

    // ---- Version ----
    version: {
      type: Number,
      default: 1
    },

    // ---- Type ----
    fileType: {
      type: String,
      enum: ["Draft", "Final"],
      default: "Draft"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("DesignFile", designFileSchema);

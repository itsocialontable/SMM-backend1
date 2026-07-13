// ==========================================
// FILE: src/models/revision.model.js
// ==========================================

const mongoose = require("mongoose");

const revisionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DesignProject",
      required: true,
      index: true
    },

    // ---- Client ne request ki ----
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User2",
      required: true
    },

    revisionMessage: {
      type: String,
      required: true,
      trim: true
    },

    // ---- Designer ka reply ----
    designerReply: {
      type: String,
      default: ""
    },

    // ---- Updated design file ----
    updatedFileUrl: {
      type: String,
      default: null
    },

    updatedFilePublicId: {
      type: String,
      default: null
    },

    // ---- Status ----
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending"
    },

    revisionNumber: {
      type: Number,
      required: true       // Konsi revision hai — 1st, 2nd, 3rd
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Revision", revisionSchema);

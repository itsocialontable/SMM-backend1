// ==========================================
// FILE: src/models/designProject.model.js
// FIXED v17: agencyId field added for multi-agency isolation
// ==========================================

const mongoose = require("mongoose");



const statusHistorySchema = new mongoose.Schema(
  {
    oldStatus: { type: String },
    newStatus: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User2" },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);
const commentSchema = new mongoose.Schema(
  {
    sender:     { type: mongoose.Schema.Types.ObjectId, ref: "User2", required: true },
    senderRole: { type: String, enum: ["Client", "SMM", "Graphic Designer", "admin"] },
    message:    { type: String, required: true, trim: true },
    createdAt:  { type: Date, default: Date.now }
  },
  { _id: true }
);

const designProjectSchema = new mongoose.Schema(
  {
    // ── AGENCY SCOPING (v17) ──────────────────────────────────────
    // Jis agency (admin) ke under ye project hai
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "Agency",
      default: null
    },

    client:     { type: mongoose.Schema.Types.ObjectId, ref: "User2", required: true },
    designer:   { type: mongoose.Schema.Types.ObjectId, ref: "User2", required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User2" },

    title:       { type: String, required: true, trim: true },
    designType:  {
      type: String,
      enum: ["Social Post","Logo","Banner","Brochure","Video Thumbnail","Story","Reel Cover","Other"],
      required: true
    },
    description:    { type: String, default: "" },
    targetAudience: { type: String, default: "" },
    brandColors:    { type: [String], default: [] },
    fontPreferences:{ type: String, default: "" },
    referenceLinks: { type: [String], default: [] },

    assets: [{
      url:       { type: String },
      publicId:  { type: String },
      label:     { type: String },
      uploadedAt:{ type: Date, default: Date.now }
    }],

    priority: { type: String, enum: ["Low","Medium","High","Urgent"], default: "Medium" },
    deadline: { type: Date, required: true },

    status: {
      type: String,
      enum: ["Pending","In Progress","SMM Review","Client Review","Revision","Completed","Cancelled"],
      default: "Pending"
    },

    progressPercentage: { type: Number, min: 0, max: 100, default: 0 },
    internalNotes:      { type: String, default: "" },
    statusHistory:      [statusHistorySchema],

    revisionCount: { type: Number, default: 0 },
    revisionLimit: { type: Number, default: 5 },

    clientApproval: {
      action:     { type: String, enum: ["approve", "reject"], default: null },
      feedback:   { type: String, default: "" },
      reviewedAt: { type: Date, default: null }
    },

    sharedWithClient: {
      isShared:  { type: Boolean, default: false },
      sharedAt:  { type: Date,    default: null },
      message:   { type: String,  default: "" }
    },

    comments: [commentSchema]
  },
  { timestamps: true }
);

designProjectSchema.index({ agencyId: 1 });
designProjectSchema.index({ agencyId: 1, status: 1 });
designProjectSchema.index({ designer: 1, status: 1 });
designProjectSchema.index({ client: 1 });
designProjectSchema.index({ assignedBy: 1 });
designProjectSchema.index({ deadline: 1 });

module.exports = mongoose.model("DesignProject", designProjectSchema);

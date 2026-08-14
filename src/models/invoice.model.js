// ==========================================
// FILE: src/models/invoice.model.js
// NEW (ADD-ON): Invoice generation support
// Admin jab client add karta hai (ya baad me bhi) to uske liye
// invoice generate kar sakta hai. Koi existing model/route/controller
// isse touch nahi hua — ye bilkul naya, alag model hai.
// ==========================================

const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity:    { type: Number, default: 1, min: 0 },
    rate:        { type: Number, default: 0, min: 0 },
    amount:      { type: Number, default: 0, min: 0 } // quantity * rate
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    // Jis agency ki taraf se invoice generate hua
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true
    },

    // Jis client ke liye invoice hai
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User2",
      required: true
    },

    // Invoice generate karne wala admin/agency
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null
    },

    invoiceNumber: { type: String, required: true, trim: true },

    items: { type: [invoiceItemSchema], default: [] },

    subtotal: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    taxAmount:  { type: Number, default: 0, min: 0 },
    discount:   { type: Number, default: 0, min: 0 },
    totalAmount:{ type: Number, default: 0, min: 0 },

    currency: { type: String, default: "INR" },

    issueDate: { type: Date, default: Date.now },
    dueDate:   { type: Date, default: null },

    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid", "Overdue", "Cancelled"],
      default: "Draft"
    },

    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

invoiceSchema.index({ agencyId: 1 });
invoiceSchema.index({ agencyId: 1, client: 1 });
invoiceSchema.index({ agencyId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model("Invoice", invoiceSchema);

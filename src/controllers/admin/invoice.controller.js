// ==========================================
// FILE: src/controllers/admin/invoice.controller.js
// NEW (ADD-ON): Invoice generation for clients
// Admin client add karte waqt (ya baad me bhi kabhi) invoice
// generate kar sakta hai. Purane kisi controller/route ko yahan
// touch nahi kiya gaya — ye bilkul alag, naya module hai.
// ==========================================

const Invoice = require("../../models/invoice.model");
const User    = require("../../models/user2.model");
const Agency  = require("../../models/agency.model");


// =====================================
// HELPER: items se subtotal/tax/total calculate karo
// =====================================
const computeTotals = (items = [], taxPercent = 0, discount = 0) => {
  const cleanItems = (items || []).map((it) => {
    const quantity = Number(it.quantity) || 1;
    const rate     = Number(it.rate) || 0;
    const amount   = it.amount !== undefined && it.amount !== null
      ? Number(it.amount)
      : quantity * rate;
    return {
      description: it.description || "",
      quantity,
      rate,
      amount
    };
  });

  const subtotal   = cleanItems.reduce((sum, it) => sum + it.amount, 0);
  const taxAmount  = (subtotal * (Number(taxPercent) || 0)) / 100;
  const totalAmount = Math.max(0, subtotal + taxAmount - (Number(discount) || 0));

  return { cleanItems, subtotal, taxAmount, totalAmount };
};


// =====================================
// HELPER: agency ke liye next invoice number generate karo
// Format: INV-YYYYMM-0001 (agency + month wise sequential)
// =====================================
const generateInvoiceNumber = async (agencyId) => {
  const now    = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const count = await Invoice.countDocuments({
    agencyId,
    invoiceNumber: { $regex: `^${prefix}` }
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

// exported so other controllers (e.g. createUser at client-add time)
// can reuse the exact same generation + totals logic
exports.computeTotals        = computeTotals;
exports.generateInvoiceNumber = generateInvoiceNumber;

// Core create-invoice logic, reusable both from this controller's
// route handler and from userAuth.controller.js (add client + invoice
// in one go).
exports.buildInvoiceForClient = async ({ agencyId, clientId, invoiceData = {} }) => {
  const {
    items, taxPercent, discount, currency,
    dueDate, notes, invoiceNumber
  } = invoiceData;

  const { cleanItems, subtotal, taxAmount, totalAmount } =
    computeTotals(items, taxPercent, discount);

  const finalInvoiceNumber = invoiceNumber || await generateInvoiceNumber(agencyId);

  const invoice = await Invoice.create({
    agencyId,
    client: clientId,
    createdBy: agencyId,
    invoiceNumber: finalInvoiceNumber,
    items: cleanItems,
    subtotal,
    taxPercent: Number(taxPercent) || 0,
    taxAmount,
    discount: Number(discount) || 0,
    totalAmount,
    currency: currency || "INR",
    dueDate: dueDate || null,
    notes: notes || ""
  });

  return invoice;
};


// =====================================
// GENERATE / CREATE INVOICE  (admin only)
// POST /api/admin/invoices
// Body: { clientId, items:[{description,quantity,rate,amount}],
//         taxPercent, discount, currency, dueDate, notes, invoiceNumber }
// =====================================
exports.generateInvoice = async (req, res) => {
  try {
    const agencyId = req.user.id; // admin khud agency hai

    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ success: false, msg: "clientId is required" });
    }

    // 🔒 client isi agency ka hona chahiye
    const client = await User.findOne({ _id: clientId, agencyId, role: "Client", isActive: true }).lean();
    if (!client) {
      return res.status(404).json({ success: false, msg: "Client not found in your agency" });
    }

    const invoice = await exports.buildInvoiceForClient({
      agencyId,
      clientId,
      invoiceData: req.body
    });

    await invoice.populate("client", "name email companyName address gstNumber");

    // ✅ NEW: agency ka logo/address/bank details bhi response mein bhejo
    // taaki frontend ko invoice PDF/UI render karne ke liye alag call na karni pade
    const agencyDoc = await Agency.findById(agencyId)
      .select("name email phoneNumber address bankDetails branding.companyLogo")
      .lean();

    const invoiceObj = invoice.toObject();

    return res.status(201).json({
      success: true,
      msg: "Invoice generated successfully",
      data: {
        invoice: invoiceObj,
        // Frontend ke liye complete, ready-to-render payload:
        //  - from      → agency (FROM: section — name, address, logo)
        //  - billTo    → client (BILL TO: section)
        //  - bankDetails → PAYMENT INFO section
        from: agencyDoc ? {
          name:         agencyDoc.name,
          email:        agencyDoc.email,
          phoneNumber:  agencyDoc.phoneNumber,
          address:      agencyDoc.address,
          logo:         agencyDoc.branding?.companyLogo || ""
        } : null,
        billTo: invoiceObj.client,
        bankDetails: agencyDoc?.bankDetails || null,
        invoiceNumber: invoiceObj.invoiceNumber,
        issueDate: invoiceObj.issueDate,
        dueDate: invoiceObj.dueDate
      }
    });

  } catch (error) {
    console.error("GENERATE INVOICE ERROR =>", error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, msg: "Invoice number already exists, try again" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET ALL INVOICES  (admin only)
// GET /api/admin/invoices?clientId=&status=&page=&limit=
// =====================================
exports.getAllInvoices = async (req, res) => {
  try {
    const agencyId = req.user.id;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = { agencyId };
    if (req.query.clientId) filter.client = req.query.clientId;
    if (req.query.status)   filter.status = req.query.status;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate("client", "name email companyName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg: "Invoices fetched successfully",
      data: {
        invoices,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });

  } catch (error) {
    console.error("GET ALL INVOICES ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET INVOICES FOR A SPECIFIC CLIENT  (admin only)
// GET /api/admin/invoices/client/:clientId
// =====================================
exports.getInvoicesByClient = async (req, res) => {
  try {
    const agencyId = req.user.id;

    const invoices = await Invoice.find({ agencyId, client: req.params.clientId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      msg: "Client invoices fetched successfully",
      data: { invoices }
    });

  } catch (error) {
    console.error("GET INVOICES BY CLIENT ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid client ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET SINGLE INVOICE  (admin only)
// GET /api/admin/invoices/:id
// =====================================
exports.getInvoiceById = async (req, res) => {
  try {
    const agencyId = req.user.id;

    const invoice = await Invoice.findOne({ _id: req.params.id, agencyId })
      .populate("client", "name email companyName gstNumber address")
      .lean();

    if (!invoice) {
      return res.status(404).json({ success: false, msg: "Invoice not found" });
    }

    return res.status(200).json({ success: true, msg: "Invoice fetched successfully", data: { invoice } });

  } catch (error) {
    console.error("GET INVOICE BY ID ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid invoice ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPDATE INVOICE STATUS  (admin only)
// PATCH /api/admin/invoices/:id/status
// Body: { status: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled" }
// =====================================
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const agencyId = req.user.id;
    const { status } = req.body;

    const validStatuses = ["Draft", "Sent", "Paid", "Overdue", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, msg: `Invalid status. Use: ${validStatuses.join(", ")}` });
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, agencyId },
      { $set: { status } },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ success: false, msg: "Invoice not found" });
    }

    return res.status(200).json({ success: true, msg: "Invoice status updated successfully", data: { invoice } });

  } catch (error) {
    console.error("UPDATE INVOICE STATUS ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid invoice ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// DELETE INVOICE  (admin only)
// DELETE /api/admin/invoices/:id
// =====================================
exports.deleteInvoice = async (req, res) => {
  try {
    const agencyId = req.user.id;

    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, agencyId });
    if (!invoice) {
      return res.status(404).json({ success: false, msg: "Invoice not found" });
    }

    return res.status(200).json({ success: true, msg: "Invoice deleted successfully" });

  } catch (error) {
    console.error("DELETE INVOICE ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid invoice ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};

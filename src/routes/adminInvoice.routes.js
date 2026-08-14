// ==========================================
// FILE: src/routes/adminInvoice.routes.js
// NEW (ADD-ON): Invoice routes — admin (agency) only
// Mounted at /api/admin/invoices in app.js
// ==========================================

const router = require("express").Router();

const {
  generateInvoice,
  getAllInvoices,
  getInvoicesByClient,
  getInvoiceById,
  updateInvoiceStatus,
  deleteInvoice
} = require("../controllers/admin/invoice.controller");

const auth    = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/isAdmin.middleware");

router.use(auth, isAdmin);

// POST /api/admin/invoices              → naya invoice generate karo (kisi bhi existing client ke liye)
router.post("/", generateInvoice);

// GET /api/admin/invoices               → saare invoices (filter: clientId, status)
router.get("/", getAllInvoices);

// GET /api/admin/invoices/client/:clientId → ek client ke saare invoices
router.get("/client/:clientId", getInvoicesByClient);

// GET /api/admin/invoices/:id           → single invoice detail
router.get("/:id", getInvoiceById);

// PATCH /api/admin/invoices/:id/status  → invoice status update (Draft/Sent/Paid/Overdue/Cancelled)
router.patch("/:id/status", updateInvoiceStatus);

// DELETE /api/admin/invoices/:id        → invoice delete
router.delete("/:id", deleteInvoice);

module.exports = router;

// ==========================================
// FILE: src/routes/agencyBranding.routes.js
// NEW v16: Agency Branding Routes
// ==========================================

const router = require("express").Router();
const {
  getBranding,
  updateBranding,
  uploadLogo,
  deleteLogo
} = require("../controllers/agencyBranding/agencyBranding.controller");

const auth             = require("../middleware/auth.middleware");
const isAdmin          = require("../middleware/isAdmin.middleware");
const upload           = require("../middleware/upload.middleware");
const { checkSubscription } = require("../middleware/subscription.middleware");

// All branding routes require: auth + admin role + active subscription
router.use(auth, isAdmin, checkSubscription);

// GET /api/agency/branding
router.get("/", getBranding);

// PUT /api/agency/branding
router.put("/", updateBranding);

// POST /api/agency/branding/logo
router.post("/logo", upload.single("logo"), uploadLogo);

// DELETE /api/agency/branding/logo
router.delete("/logo", deleteLogo);

module.exports = router;

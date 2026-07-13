// ==========================================
// FILE: src/routes/agencyAuth.routes.js
// UPDATED v16: Added /me and /subscription-status routes
// ==========================================

const router = require("express").Router();
const {
  loginAgency,
  forgotPassword,
  verifyResetOtp,
  resendResetOtp,
  resetPassword,
  changePassword
} = require("../controllers/auth/agencyAuth.controller");
const auth    = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/isAdmin.middleware");
const Agency  = require("../models/agency.model");

// POST /api/agency/login
router.post("/login", loginAgency);

// ================= FORGOT PASSWORD FLOW (v18 — Admin model hata diya, ye yahan aa gaya) =================
router.post("/forgot-password",   forgotPassword);
router.post("/verify-reset-otp",  verifyResetOtp);
router.post("/resend-reset-otp",  resendResetOtp);
router.post("/reset-password",    resetPassword);

// Logged-in agency apna password badal sake
router.post("/change-password", auth, isAdmin, changePassword);

// GET /api/agency/me — get own profile
router.get("/me", auth, isAdmin, async (req, res) => {
  try {
    const agency = await Agency.findById(req.user.id).select("-password").lean();
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });
    return res.status(200).json({ success: true, data: { agency } });
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// GET /api/agency/subscription-status — get trial/subscription info
router.get("/subscription-status", auth, isAdmin, async (req, res) => {
  try {
    const agency = await Agency.findById(req.user.id)
      .select("subscriptionStatus planType trialStartDate trialEndDate subscriptionExpiry")
      .lean();
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });

    const now = new Date();
    let daysRemaining = null;
    if (agency.subscriptionStatus === "trial" && agency.trialEndDate) {
      daysRemaining = Math.max(0, Math.ceil((new Date(agency.trialEndDate) - now) / (1000 * 60 * 60 * 24)));
    } else if (agency.subscriptionStatus === "active" && agency.subscriptionExpiry) {
      daysRemaining = Math.max(0, Math.ceil((new Date(agency.subscriptionExpiry) - now) / (1000 * 60 * 60 * 24)));
    }

    return res.status(200).json({
      success: true,
      data: {
        subscriptionStatus:  agency.subscriptionStatus,
        planType:            agency.planType,
        trialStartDate:      agency.trialStartDate,
        trialEndDate:        agency.trialEndDate,
        subscriptionExpiry:  agency.subscriptionExpiry,
        daysRemaining
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message });
  }
});

module.exports = router;

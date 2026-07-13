// ==========================================
// FILE: src/routes/auth.routes.js
// FIXED: Removed /register (users created by agency admin only)
//        Removed OTP login flow (not used in User2 system)
//        Only: login, forgot-password, verify-reset-otp, reset-password, change-password
// ==========================================

const express = require("express");
const router = express.Router();

const {
  login,
  forgotPassword,
  verifyResetOtp,
  changePassword,
  resetForgotPassword
} = require("../controllers/auth/auth.controller");

const auth = require("../middleware/auth.middleware");

// Public routes
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetForgotPassword);

// Logged-in user
router.post("/change-password", auth, changePassword);

module.exports = router;

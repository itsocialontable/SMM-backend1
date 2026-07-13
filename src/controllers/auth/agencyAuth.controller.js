// ==========================================
// FILE: src/controllers/auth/agencyAuth.controller.js
// UPDATED v18: Agency login by email + password only (no role required)
// Agency creation ab SuperAdmin karta hai, yahan se hata diya
// Admin model hata diya gaya — Agency hi apna forgot-password/change-password
// khud handle karti hai (pehle ye Admin model me alag se tha)
// ==========================================


const Agency = require("../../models/agency.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../../utils/email.util");


// =====================================
// LOGIN AGENCY
// POST /api/agency/login
// Body: email, password
// =====================================

exports.loginAgency = async (req, res) => {

  try {

    const { email, password } = req.body;

    // ================= VALIDATION =================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Email and password are required"
      });
    }

    // ================= FIND AGENCY =================

    const agency = await Agency.findOne({ email: email.toLowerCase().trim() });

    if (!agency) {
      return res.status(404).json({
        success: false,
        msg: "Agency not found. Please check your email."
      });
    }

    // ================= CHECK ACTIVE =================

    if (!agency.isActive) {
      return res.status(403).json({
        success: false,
        msg: "Your agency account has been deactivated. Please contact SuperAdmin."
      });
    }

    // ================= CHECK PASSWORD =================

    const isMatch = await bcrypt.compare(password, agency.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        msg: "Invalid credentials"
      });
    }

    // ================= SAVE LOGIN SOURCE =================

    const source = req.body.source || req.headers["x-login-source"] || "web";
    agency.loginSource = ["web", "app"].includes(source) ? source : "web";
    await agency.save();

    // ================= GENERATE TOKEN =================
    // role = "admin" — Agency hi system me "admin" hai, alag Admin model nahi hai

    const token = jwt.sign(
      {
        id: agency._id,
        role: agency.role     // "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const agencyData = agency.toObject();
    delete agencyData.password;
    delete agencyData.resetOtp;
    delete agencyData.resetOtpExpire;
    delete agencyData.resetOtpVerified;

    // ================= RESPONSE =================

    return res.status(200).json({
      success: true,
      msg: "Agency login successful",
      token,
      agency: agencyData
    });

  } catch (error) {

    console.error("AGENCY LOGIN ERROR =>", error);

    return res.status(500).json({
      success: false,
      msg: error.message
    });

  }

};


// =====================================
// FORGOT PASSWORD — SEND OTP
// POST /api/agency/forgot-password
// =====================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, msg: "Email is required" });
    }

    const agency = await Agency.findOne({ email: email.toLowerCase().trim() });

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    if (!agency.isActive) {
      return res.status(403).json({ success: false, msg: "Account deactivated. Contact SuperAdmin." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    agency.resetOtp           = otp;
    agency.resetOtpExpire     = Date.now() + 10 * 60 * 1000;
    agency.resetOtpVerified   = false;
    await agency.save();

    // sendEmail default template use karega (event match na hone par)
    await sendEmail({
      to:    agency.email,
      name:  agency.name,
      event: "agency_password_reset_otp",
      templateData: {
        title:   "Password Reset OTP",
        message: `Your OTP is ${otp}. It is valid for 10 minutes.`
      }
    }).catch(err => console.error("FORGOT PASSWORD EMAIL ERROR =>", err.message));

    return res.status(200).json({ success: true, msg: "Reset OTP sent to your email" });

  } catch (error) {
    console.error("AGENCY FORGOT PASSWORD ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// VERIFY RESET OTP
// POST /api/agency/verify-reset-otp
// =====================================

exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, msg: "Email and OTP required" });
    }

    const agency = await Agency.findOne({ email: email.toLowerCase().trim() });

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    if (!agency.resetOtp || agency.resetOtp !== otp.toString()) {
      return res.status(400).json({ success: false, msg: "Invalid OTP" });
    }

    if (!agency.resetOtpExpire || agency.resetOtpExpire < Date.now()) {
      return res.status(400).json({ success: false, msg: "OTP expired" });
    }

    agency.resetOtpVerified = true;
    await agency.save();

    return res.status(200).json({ success: true, msg: "OTP verified successfully" });

  } catch (error) {
    console.error("AGENCY VERIFY OTP ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// RESEND RESET OTP
// POST /api/agency/resend-reset-otp
// =====================================

exports.resendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, msg: "Email is required" });
    }

    const agency = await Agency.findOne({ email: email.toLowerCase().trim() });

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    agency.resetOtp         = otp;
    agency.resetOtpExpire   = Date.now() + 10 * 60 * 1000;
    agency.resetOtpVerified = false;
    await agency.save();

    await sendEmail({
      to:    agency.email,
      name:  agency.name,
      event: "agency_password_reset_otp",
      templateData: {
        title:   "Your New OTP",
        message: `Your new OTP is ${otp}. It is valid for 10 minutes.`
      }
    }).catch(err => console.error("RESEND OTP EMAIL ERROR =>", err.message));

    return res.status(200).json({ success: true, msg: "OTP resent successfully" });

  } catch (error) {
    console.error("AGENCY RESEND OTP ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// RESET PASSWORD (after OTP verified)
// POST /api/agency/reset-password
// =====================================

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, msg: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, msg: "Passwords do not match" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, msg: "Password must be at least 8 characters" });
    }

    const agency = await Agency.findOne({ email: email.toLowerCase().trim() });

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    if (!agency.resetOtpVerified) {
      return res.status(400).json({ success: false, msg: "Please verify OTP first" });
    }

    agency.password         = await bcrypt.hash(newPassword, 10);
    agency.resetOtp         = null;
    agency.resetOtpExpire   = null;
    agency.resetOtpVerified = false;
    await agency.save();

    return res.status(200).json({ success: true, msg: "Password reset successful" });

  } catch (error) {
    console.error("AGENCY RESET PASSWORD ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// CHANGE PASSWORD (logged-in agency)
// POST /api/agency/change-password
// =====================================

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, msg: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, msg: "Passwords do not match" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, msg: "New password must be at least 8 characters" });
    }

    const agency = await Agency.findById(req.user.id);

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, agency.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, msg: "Old password is incorrect" });
    }

    agency.password = await bcrypt.hash(newPassword, 10);
    await agency.save();

    return res.status(200).json({ success: true, msg: "Password changed successfully" });

  } catch (error) {
    console.error("AGENCY CHANGE PASSWORD ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// ==========================================
// FILE: src/controllers/auth/auth.controller.js
// FIXED: All references to old User model replaced with User2
//        register() removed (users created by agency admin now)
//        resendOtp, forgotPassword, verifyResetOtp, resetForgotPassword, changePassword — all use User2
// ==========================================

const User2 = require("../../models/user2.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

// ================= HELPERS =================
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const isValidEmail = (email) => {
  return /^\S+@\S+\.\S+$/.test(email);
};

// UPDATED: Gmail SMTP se Resend (HTTP API) pe switch kiya — same wajah
// jaisi email.util.js me — Render free tier pe SMTP ports blocked hote
// hain, Resend HTTPS API se hamesha kaam karta hai.
const sendEmail = async (to, subject, text) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Growth Craft 360 <onboarding@resend.dev>";

  if (!RESEND_API_KEY) {
    console.log("EMAIL not configured (RESEND_API_KEY missing) — skipping OTP email");
    return null;
  }

  await axios.post(
    "https://api.resend.com/emails",
    { from: RESEND_FROM_EMAIL, to, subject, text },
    { headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" } }
  );
};

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ================= LOGIN =================
// NOTE: Users are created by agency admin — no public register endpoint
exports.login = async (req, res) => {
  try {
    const { email, password, source } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password required" });
    }

    const user = await User2.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // ✅ isActive check — deleted/deactivated users blocked here
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        msg: "Your account has been deactivated or deleted. Please contact admin."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid password" });
    }

    user.loginSource = source || "web";
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      msg: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ msg: "Email required" });

    const user = await User2.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ msg: "User not found" });

    if (!user.isActive) {
      return res.status(403).json({ success: false, msg: "Account deactivated. Contact admin." });
    }

    const otp = generateOtp();

    user.resetOtp = otp;
    user.resetOtpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendEmail(
      user.email,
      "Password Reset OTP",
      `Your OTP is ${otp}. It expires in 10 minutes.`
    );

    return res.json({ success: true, msg: "Reset OTP sent" });

  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

// ================= VERIFY RESET OTP =================
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ msg: "Email and OTP required" });
    }

    const user = await User2.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    if (!user.resetOtp || user.resetOtp !== otp.toString()) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (user.resetOtpExpiry < Date.now()) {
      return res.status(400).json({ msg: "OTP expired" });
    }

    user.resetOtpVerifiedAt = Date.now();
    await user.save();

    return res.json({ success: true, msg: "OTP verified" });

  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

// ================= RESET FORGOT PASSWORD =================
exports.resetForgotPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ msg: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const user = await User2.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    if (!user.resetOtpVerifiedAt) {
      return res.status(400).json({ msg: "OTP not verified" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    user.resetOtpVerifiedAt = null;

    await user.save();

    return res.json({ success: true, msg: "Password reset successful" });

  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

// ================= CHANGE PASSWORD (logged-in user) =================
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ msg: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ msg: "Passwords do not match" });
    }

    const user = await User2.findById(req.user.id);

    if (!user) return res.status(400).json({ msg: "User not found" });

    if (!user.isActive) {
      return res.status(403).json({ success: false, msg: "Account deactivated. Contact admin." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Old password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.json({ success: true, msg: "Password changed successfully" });

  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

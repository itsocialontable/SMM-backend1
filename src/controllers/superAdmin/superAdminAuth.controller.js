// ==========================================
// FILE: src/controllers/superAdmin/superAdminAuth.controller.js
// SuperAdmin: Register (ek hi), Login
// ==========================================

const SuperAdmin = require("../../models/superAdmin.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


// =====================================
// SUPER ADMIN REGISTER
// Sirf ek hi SuperAdmin register ho sakta hai
// =====================================

exports.registerSuperAdmin = async (req, res) => {

  try {

    const { name, email, password, confirmPassword } = req.body;

    // ================= VALIDATION =================

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        msg: "All fields required (name, email, password, confirmPassword)"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        msg: "Passwords do not match"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        msg: "Password must be at least 8 characters"
      });
    }

    // ================= ONLY ONE SUPER ADMIN =================

    const existing = await SuperAdmin.findOne();

    if (existing) {
      return res.status(400).json({
        success: false,
        msg: "SuperAdmin already exists. Only one SuperAdmin is allowed."
      });
    }

    // ================= HASH PASSWORD =================

    const hashedPassword = await bcrypt.hash(password, 10);

    // ================= CREATE SUPER ADMIN =================

    const superAdmin = await SuperAdmin.create({
      name,
      email,
      password: hashedPassword
    });

    const superAdminData = superAdmin.toObject();
    delete superAdminData.password;

    // ================= RESPONSE =================

    return res.status(201).json({
      success: true,
      msg: "SuperAdmin registered successfully",
      superAdmin: superAdminData
    });

  } catch (error) {

    console.error("SUPER ADMIN REGISTER ERROR =>", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: "Email already in use"
      });
    }

    return res.status(500).json({
      success: false,
      msg: error.message
    });

  }

};



// =====================================
// SUPER ADMIN LOGIN
// =====================================

exports.loginSuperAdmin = async (req, res) => {

  try {

    const { email, password } = req.body;

    // ================= VALIDATION =================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Email and password are required"
      });
    }

    // ================= FIND SUPER ADMIN =================

    const superAdmin = await SuperAdmin.findOne({ email });

    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        msg: "SuperAdmin not found"
      });
    }

    // ================= CHECK PASSWORD =================

    const isMatch = await bcrypt.compare(password, superAdmin.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        msg: "Invalid credentials"
      });
    }

    // ================= GENERATE TOKEN =================

    const token = jwt.sign(
      {
        id: superAdmin._id,
        role: superAdmin.role     // "superadmin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const superAdminData = superAdmin.toObject();
    delete superAdminData.password;

    // ================= RESPONSE =================

    return res.status(200).json({
      success: true,
      msg: "SuperAdmin login successful",
      token,
      superAdmin: superAdminData
    });

  } catch (error) {

    console.error("SUPER ADMIN LOGIN ERROR =>", error);

    return res.status(500).json({
      success: false,
      msg: error.message
    });

  }

};

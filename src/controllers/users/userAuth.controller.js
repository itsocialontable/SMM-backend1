// ==========================================
// FILE: src/controllers/users/userAuth.controller.js
// UPDATED v20: createUser — new client fields added
//              (serviceKey, gstNumber, address, projectTitle,
//               duration, description, smmList, gdList)
// ==========================================

const User      = require("../../models/user2.model");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const sendEmail = require("../../utils/email.util");


// =====================================
// CREATE USER BY ADMIN
// POST /api/user/create
// =====================================
exports.createUser = async (req, res) => {
  try {
    let {
      name, email, password, role,
      profileImage, phoneNumber,

      // Basic client fields
      companyName, industry, budget,

      // ── NEW v20: Extended client fields ──
      serviceKey, gstNumber, address,
      projectTitle, duration, description,
      smmList, gdList, connectedDevices,

      // SMM / GD fields
      experience, skills, platforms, specialization
    } = req.body;

    email = email?.toLowerCase().trim();

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, msg: "Required fields missing: name, email, password, role" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, msg: "Password must be at least 8 characters" });
    }

    const validRoles = ["Client", "SMM", "Graphic Designer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, msg: "Invalid role. Use: Client, SMM, Graphic Designer" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, msg: "User already exists with this email" });
    }

    const plainPassword  = password;
    const hashedPassword = await bcrypt.hash(password, 10);

    // agencyId from the admin (Agency) creating the user
    // Agency model ka role hamesha "admin" hota hai — Admin model hata diya gaya hai
    const agencyId = (req.user?.role === "admin" || req.user?.role === "Admin") ? req.user.id : null;

    const user = await User.create({
      name, email, password: hashedPassword, role,
      profileImage, phoneNumber,
      companyName, industry, budget,

      // New client fields (only stored for Client role, ignored for others)
      serviceKey:   role === "Client" ? (serviceKey   || "") : undefined,
      gstNumber:    role === "Client" ? (gstNumber    || "") : undefined,
      address:      role === "Client" ? (address      || "") : undefined,
      projectTitle: role === "Client" ? (projectTitle || "") : undefined,
      duration:     role === "Client" ? (duration     || "") : undefined,
      description:  role === "Client" ? (description  || "") : undefined,
      smmList:      role === "Client" ? (smmList      || []) : undefined,
      gdList:       role === "Client" ? (gdList       || []) : undefined,
      connectedDevices: role === "Client" ? (connectedDevices || []) : undefined,

      experience, skills, platforms, specialization,
      agencyId
    });

    // Agency ka naam nikal rahe hain taaki naye user ki welcome email me
    // pata chale ki wo kis agency se belong karta hai
    const Agency = require("../../models/agency.model");
    const agencyDoc = agencyId ? await Agency.findById(agencyId).select("name") : null;

    sendEmail({
      to: email, name, event: "account_created",
      templateData: { name, role, email, password: plainPassword, agencyName: agencyDoc?.name || "" }
    }).catch(err => console.error("Welcome email error:", err.message));

    const userData = user.toObject();
    delete userData.password;

    return res.status(201).json({ success: true, msg: `${role} created successfully`, data: { user: userData } });

  } catch (error) {
    console.error("CREATE USER ERROR =>", error);
    if (error.code === 11000) return res.status(400).json({ success: false, msg: "User already exists with this email" });
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// =====================================
// LOGIN USER
// POST /api/user/login
// FIXED v18.1:
//  1. role ab pehle validate hota hai — undefined/invalid role se
//     Mongoose silently query ignore karta tha aur koi bhi user
//     mil jaata tha bina role match ke. Ab explicit check pehle.
//  2. wrong role pe clear error — "Client" credentials se "SMM"
//     dashboard access NAHI milega, seedha "Access denied" milega.
//  3. isActive: false (deleted ya deactivated) — login blocked.
// =====================================
exports.loginUser = async (req, res) => {
  try {
    let { email, password, role } = req.body;
    email = email?.toLowerCase().trim();

    // ── Step 1: Saare fields mandatory ──────────────────────────
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        msg: "email, password and role — all three are required"
      });
    }

    // ── Step 2: Role pehle validate karo (DB hit se pehle) ──────
    // Agar role invalid hai ya nahi diya to Mongoose { email, role }
    // query mein role: undefined / role: "XYZ" se ya to ignore karta
    // hai ya wrong result deta hai.
    const validRoles = ["Client", "SMM", "Graphic Designer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        msg: `Invalid role. Valid roles: ${validRoles.join(", ")}`
      });
    }

    // ── Step 3: Email + ROLE dono se dhundho ────────────────────
    // role explicitly diya aur valid hai — ab safe hai query karna
    const user = await User.findOne({ email, role });

    // ── Step 4: User exist karta hai? ───────────────────────────
    if (!user) {
      // Client email correct hai but role "SMM" diya — isko bhi
      // "User not found" hi kehna chahiye (role expose mat karo).
      // Agar alag user same email pe doosri agency me ho aur role
      // match na kare, tab bhi yahi response milega.
      return res.status(404).json({
        success: false,
        msg: "User not found. Incorrect email or role."
      });
    }

    // ── Step 5: Deleted ya deactivated check ────────────────────
    // isActive: false — agency ne delete ya deactivate kiya hai.
    // isDeleted flag bhi check karte hain (hard delete ke baad
    // record nahi bachega, lekin extra safety ke liye).
    if (!user.isActive) {
      // deletedAt set hai — permanently delete hua tha
      if (user.deletedAt) {
        return res.status(403).json({
          success: false,
          msg: "This account has been permanently deleted. Please contact your agency."
        });
      }
      // sirf deactivated
      return res.status(403).json({
        success: false,
        msg: "Your account has been deactivated. Please contact your agency admin."
      });
    }

    // ── Step 6: Password verify ──────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        msg: "Invalid credentials"
      });
    }

    // ── Step 7: Login source save karo ──────────────────────────
    const source = req.body.source || req.headers["x-login-source"] || "web";
    user.loginSource = ["web", "app"].includes(source) ? source : "web";
    await user.save();

    // ── Step 8: JWT sign karo — role user ke DB record se lena ──
    // IMPORTANT: role token mein DB wala role use karo, body ka nahi.
    // (body me user ne kuch bhi diya ho, actual role DB se aata hai)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userData = user.toObject();
    delete userData.password;

    return res.status(200).json({
      success: true,
      msg: "Login successful",
      token,
      data: { user: userData }
    });

  } catch (error) {
    console.error("LOGIN USER ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// ==========================================
// FILE: src/controllers/admin/userManagement.controller.js
// FIXED: 
//   - deleteUser now does SOFT DELETE (isActive: false) — deleted user can't login
//   - agencyId isolation on all queries — agency sirf apna data dekhe
// ==========================================

const User = require("../../models/user2.model");
const bcrypt = require("bcryptjs");


// =====================================
// HELPER: Build filter by role + agencyId
// =====================================

const buildQuery = (role, agencyId, extraFilters = {}) => ({
  role,
  agencyId,
  ...extraFilters
});


// =====================================
// HELPER (v18 FIX): Correct agencyId resolve karo based on caller role
// Pehle har function me "const agencyId = req.user.id" tha — ye sirf
// Agency (role: "admin") ke liye sahi hai, kyunki Agency._id == agencyId.
// Ye route SMM bhi access karta hai (/clients, /graphic-designers —
// dropdown ke liye), aur SMM ka req.user.id uska APNA User2._id hai,
// agencyId nahi! Isse SMM ko hamesha KHAALI list milti thi.
// =====================================

const resolveAgencyId = async (req) => {
  if (req.user.role === "admin" || req.user.role === "Admin") {
    return req.user.id;          // Agency khud — id hi agencyId hai
  }
  // SMM / Graphic Designer — apna agencyId User2 se nikalo
  const me = await User.findById(req.user.id).select("agencyId").lean();
  return me?.agencyId || null;
};


// =====================================
// HELPER: Paginate & sort
// =====================================

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 10);
  const skip  = (page - 1) * limit;
  const sort  = query.sort === "asc" ? 1 : -1;
  return { page, limit, skip, sort };
};


// =====================================
// GET ALL CLIENTS  (Agency + SMM)
// GET /api/admin/users/clients
// v18 FIX: SMM ke liye agencyId ab resolveAgencyId() se sahi nikalta hai
// =====================================

exports.getAllClients = async (req, res) => {
  try {
    const agencyId = await resolveAgencyId(req);

    if (!agencyId) {
      return res.status(400).json({ success: false, msg: "agencyId not found for this user" });
    }

    const { page, limit, skip, sort } = getPagination(req.query);

    const searchFilter = req.query.search
      ? {
          $or: [
            { name:  { $regex: req.query.search, $options: "i" } },
            { email: { $regex: req.query.search, $options: "i" } }
          ]
        }
      : {};

    // isActive: true — soft-deleted users list mein na aayein
    const filter = buildQuery("Client", agencyId, { isActive: true, ...searchFilter });

    const [clients, total] = await Promise.all([
      User.find(filter)
          .select("-password")
          .populate("smmList", "name email")
          .populate("gdList",  "name email")
          .sort({ createdAt: sort })
          .skip(skip)
          .limit(limit)
          .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg:     "Clients fetched successfully",
      data: {
        clients,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });

  } catch (error) {
    console.error("GET ALL CLIENTS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET ALL SMMs  (admin only)
// GET /api/admin/users/smm
// =====================================

exports.getAllSMMs = async (req, res) => {
  try {
    // ✅ FIXED v19: resolveAgencyId use karo taaki SMM bhi apni
    // agency ki SMM list dekh sake (pehle req.user.id tha jo SMM
    // ke liye uska apna User2._id tha, agencyId nahi — khaali list aati thi)
    const agencyId = await resolveAgencyId(req);

    if (!agencyId) {
      return res.status(400).json({ success: false, msg: "agencyId not found for this user" });
    }
    const { page, limit, skip, sort } = getPagination(req.query);

    const searchFilter = req.query.search
      ? {
          $or: [
            { name:  { $regex: req.query.search, $options: "i" } },
            { email: { $regex: req.query.search, $options: "i" } }
          ]
        }
      : {};

    const filter = buildQuery("SMM", agencyId, { isActive: true, ...searchFilter });

    const [smms, total] = await Promise.all([
      User.find(filter)
          .select("-password")
          .sort({ createdAt: sort })
          .skip(skip)
          .limit(limit)
          .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg:     "SMMs fetched successfully",
      data: {
        smms,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });

  } catch (error) {
    console.error("GET ALL SMMS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET ALL GRAPHIC DESIGNERS  (Agency + SMM)
// GET /api/admin/users/graphic-designers
// v18 FIX: SMM ke liye agencyId ab resolveAgencyId() se sahi nikalta hai
// =====================================

exports.getAllGraphicDesigners = async (req, res) => {
  try {
    const agencyId = await resolveAgencyId(req);

    if (!agencyId) {
      return res.status(400).json({ success: false, msg: "agencyId not found for this user" });
    }

    const { page, limit, skip, sort } = getPagination(req.query);

    const searchFilter = req.query.search
      ? {
          $or: [
            { name:  { $regex: req.query.search, $options: "i" } },
            { email: { $regex: req.query.search, $options: "i" } }
          ]
        }
      : {};

    const filter = buildQuery("Graphic Designer", agencyId, { isActive: true, ...searchFilter });

    const [designers, total] = await Promise.all([
      User.find(filter)
          .select("-password")
          .sort({ createdAt: sort })
          .skip(skip)
          .limit(limit)
          .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg:     "Graphic Designers fetched successfully",
      data: {
        designers,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });

  } catch (error) {
    console.error("GET ALL GRAPHIC DESIGNERS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET SINGLE USER BY ID  (admin only)
// GET /api/admin/users/:id
// =====================================

exports.getUserById = async (req, res) => {
  try {
    const agencyId = req.user.id;

    const user = await User.findOne({
      _id: req.params.id,
      agencyId,
      isActive: true   // soft-deleted user nahi milega
    })
      .select("-password")
      .populate("smmList", "name email")
      .populate("gdList",  "name email")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    return res.status(200).json({
      success: true,
      msg:  "User fetched successfully",
      data: { user }
    });

  } catch (error) {
    console.error("GET USER BY ID ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid user ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPDATE USER  (admin only)
// PUT /api/admin/users/:id
// =====================================

exports.updateUser = async (req, res) => {
  try {
    const agencyId = req.user.id;

    const PROTECTED = ["password", "role", "createdByAdmin", "_id", "__v", "agencyId"];
    PROTECTED.forEach((field) => delete req.body[field]);

    if (req.body.email) {
      req.body.email = req.body.email.toLowerCase().trim();

      const duplicate = await User.findOne({
        email: req.body.email,
        _id:   { $ne: req.params.id }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          msg: "Email already in use by another user"
        });
      }
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.params.id, agencyId, isActive: true },
      { $set: req.body },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    return res.status(200).json({
      success: true,
      msg:  "User updated successfully",
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error("UPDATE USER ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid user ID" });
    }
    if (error.code === 11000) {
      return res.status(400).json({ success: false, msg: "Email already in use" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// CHANGE USER PASSWORD  (admin only)
// PUT /api/admin/users/:id/change-password
// =====================================

exports.changeUserPassword = async (req, res) => {
  try {
    const agencyId = req.user.id;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        msg: "newPassword and confirmPassword are required"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, msg: "Passwords do not match" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, msg: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({ _id: req.params.id, agencyId, isActive: true });

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ success: true, msg: "Password changed successfully" });

  } catch (error) {
    console.error("CHANGE USER PASSWORD ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid user ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// TOGGLE USER ACTIVE STATUS  (admin only)
// PATCH /api/admin/users/:id/toggle-status
// =====================================

// =====================================
// TOGGLE USER STATUS (activate / deactivate)
// PATCH /api/admin/users/:id/toggle-status
//
// FIXED v18.1: Deactivated user (isActive: false) login nahi kar
// sakta — loginUser isActive check karta hai, checkUserActive
// middleware bhi har protected route pe isActive check karta hai.
// Isliye deactivate karte hi user ka access turant band ho jaata hai.
// =====================================
exports.toggleUserStatus = async (req, res) => {
  try {
    const agencyId = req.user.id;

    const user = await User.findOne({ _id: req.params.id, agencyId });

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found or you don't have permission"
      });
    }

    const wasActive = user.isActive;
    user.isActive = !wasActive;
    await user.save();

    return res.status(200).json({
      success: true,
      msg: user.isActive
        ? `${user.name} (${user.role}) has been activated — they can now login.`
        : `${user.name} (${user.role}) has been deactivated — login and all access blocked immediately.`,
      data: {
        userId:   user._id,
        name:     user.name,
        role:     user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error("TOGGLE USER STATUS ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid user ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// DELETE USER  (admin only) — SOFT DELETE
// DELETE /api/admin/users/:id
//
// ✅ FIX: findOneAndDelete se hataya — ab isActive: false karta hai
//         Isse deleted user login nahi kar payega (loginUser isActive check karta hai)
//         UI list mein bhi nahi aayega (isActive: true filter se)
// =====================================

// =====================================
// DELETE USER  (admin only) — HARD DELETE
// DELETE /api/admin/users/:id
//
// FIXED v18.1: User ne explicitly bola — "permanent hi delete ho
// jana chahiye DB se taki firse login na kar sake".
// Pehle ye soft delete tha (isActive: false). Ab permanently
// DB se remove karte hain. Logged-in sessions (JWT tokens) bhi
// automatically expire ho jaayenge kyunki:
//   - Fresh login → User not found (404)
//   - Existing token → checkUserActive → User not found (404)
// =====================================
exports.deleteUser = async (req, res) => {
  try {
    const agencyId = req.user.id;

    // 🔒 agencyId check — dusri agency ka user delete nahi hoga
    const user = await User.findOne({ _id: req.params.id, agencyId });

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found or you don't have permission to delete this user"
      });
    }

    // ── Permanently delete from DB ──────────────────────────────
    await User.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      msg: "User permanently deleted successfully",
      data: {
        deletedUserId: user._id,
        name:  user.name,
        email: user.email,
        role:  user.role
      }
    });

  } catch (error) {
    console.error("DELETE USER ERROR =>", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, msg: "Invalid user ID" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET ALL USERS (all roles combined)
// GET /api/admin/users?status=active|inactive|all
// FIXED v18.1: Hard delete ke baad record DB me nahi bachta so koi
// issue nahi. Deactivated users — default mein sirf active dikhenge
// jab tak ?status=all ya ?status=inactive na diya ho.
// =====================================
exports.getAllUsers = async (req, res) => {
  try {
    const agencyId = req.user.id;
    const { page, limit, skip, sort } = getPagination(req.query);

    // status filter: default = "active" (deactivated list me nahi chahiye by default)
    const statusFilter = req.query.status === "inactive"
      ? { isActive: false }
      : req.query.status === "all"
        ? {}
        : { isActive: true };

    const searchFilter = req.query.search
      ? {
          $or: [
            { name:  { $regex: req.query.search, $options: "i" } },
            { email: { $regex: req.query.search, $options: "i" } }
          ]
        }
      : {};

    const filter = { agencyId, ...statusFilter, ...searchFilter };

    const [users, total] = await Promise.all([
      User.find(filter)
          .select("-password")
          .sort({ createdAt: sort })
          .skip(skip)
          .limit(limit)
          .lean(),
      User.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg: "Users fetched successfully",
      data: {
        users,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });

  } catch (error) {
    console.error("GET ALL USERS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// NOTE (v18): createUser yahan se hata diya gaya hai.
// User banane ka SAHI/SINGLE tareeka POST /api/user/create hai
// (userAuth.controller.js) — wahi subscription + trial-limit
// checks karta hai aur User2 schema ke sahi fields (role enum
// "Client"/"SMM"/"Graphic Designer", phoneNumber) use karta hai.
// Pehle yahan ek duplicate createUser tha jo "GD" role allow
// karta tha (jo model ke enum me hi nahi tha) aur koi proper
// admin-only auth check bhi nahi tha — isliye hata diya.
// =====================================

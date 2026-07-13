// ==========================================
// FILE: src/middleware/checkUserActive.middleware.js
// FIXED v18.1:
//  - Hard delete ke baad user DB me hoga hi nahi — ab "not found"
//    ko 401 Unauthorized maante hain (user ka token valid dikhta
//    hai but user exist nahi karta — expired/invalid session)
//  - isActive: false (deactivated) → 403 Access Denied
//  - SuperAdmin (both cases) aur Agency (admin) skip — unka
//    record User2 me hota hi nahi
// ==========================================

const User2 = require("../models/user2.model");

const checkUserActive = async (req, res, next) => {
  try {
    const { id, role } = req.user || {};

    if (!id) {
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    // Agency (admin) aur SuperAdmin — User2 me nahi hote, skip
    if (
      role === "Admin" || role === "admin" ||
      role === "SuperAdmin" || role === "superadmin"
    ) {
      return next();
    }

    const user = await User2.findById(id).select("isActive deletedAt").lean();

    // ── User DB me nahi mila ─────────────────────────────────────
    // Hard delete ke baad record exist nahi karta. Token technically
    // valid hai (signature sahi hai) but user gone — session invalid.
    if (!user) {
      return res.status(401).json({
        success: false,
        msg: "Session expired or account no longer exists. Please login again."
      });
    }

    // ── Deactivated user ─────────────────────────────────────────
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        msg: "Your account has been deactivated. Please contact your agency admin."
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

module.exports = checkUserActive;

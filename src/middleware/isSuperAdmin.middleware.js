// ==========================================
// FILE: src/middleware/isSuperAdmin.middleware.js
// ==========================================

module.exports = (req, res, next) => {
  const role = req.user?.role;

  if (role !== "superadmin") {
    return res.status(403).json({
      success: false,
      msg: "Access denied: SuperAdmin only"
    });
  }

  next();
};

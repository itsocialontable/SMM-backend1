// ==========================================
// FILE: src/middleware/role.middleware.js
// FIXED v19: Clean file — old commented code removed.
// Case-insensitive role check.
// ==========================================

module.exports = (roles) => {
  return (req, res, next) => {
    const userRole     = req.user?.role?.toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        msg: "Access denied"
      });
    }
    next();
  };
};

// ==========================================
// FILE: src/middleware/isAdminOrSMM.middleware.js
// ==========================================

const isAdminOrSMM = (req, res, next) => {
  const role = req.user?.role;
  if (role === "admin" || role === "Admin" || role === "SMM") return next();
  return res.status(403).json({
    success: false,
    msg: "Access denied. Admin or SMM role required."
  });
};

module.exports = isAdminOrSMM;

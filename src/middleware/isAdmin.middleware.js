// ==========================================
// FILE: src/middleware/isAdmin.middleware.js
// UPDATED v18: Admin model hata diya gaya — sirf Agency (role: "admin")
//   hi is check ko pass karti hai. "agency"/"Agency" string values kabhi
//   kisi token me nahi aati (Agency.role default hamesha "admin" hai),
//   lekin tolerance ke liye check rakha hai.
// ==========================================
module.exports = (req, res, next) => {
  const role = req.user?.role;
  if (
    role !== "admin" &&
    role !== "Admin" &&
    role !== "agency" &&
    role !== "Agency"
  ) {
    return res.status(403).json({
      success: false,
      msg: "Access denied: Agency (admin) only"
    });
  }
  next();
};
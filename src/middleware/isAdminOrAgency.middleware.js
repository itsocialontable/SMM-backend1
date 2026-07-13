module.exports = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "admin" && role !== "Admin" && role !== "agency" && role !== "Agency") {
    return res.status(403).json({
      success: false,
      msg: "Access denied: Admin or Agency only"
    });
  }
  next();
};
// ==========================================
// FILE: src/routes/user.routes.js
// Profile routes for logged-in users (SMM, Client, GD)
// ==========================================

const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");

const {
  getProfile,
  updateProfile,
  deleteProfile
} = require("../controllers/users/profile.controller");

router.get("/profile", auth, checkUserActive, getProfile);
router.put("/profile", auth, checkUserActive, updateProfile);
router.delete("/profile", auth, checkUserActive, deleteProfile);

module.exports = router;

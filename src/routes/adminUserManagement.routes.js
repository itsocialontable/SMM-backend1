// ==========================================
// FILE: src/routes/adminUserManagement.routes.js
// UPDATED v18: duplicate/broken POST /create route hata diya gaya.
//   User banane ka ek hi sahi route hai: POST /api/user/create
//   (userAuth.routes.js) — subscription + trial-limit checks ke saath.
// PRODUCTION FIX: clients + graphic-designers list routes SMM bhi
// access kar sakta hai. Baaki sab Agency ("admin") only.
// ==========================================

const router = require("express").Router();

const {
  getAllUsers, getAllClients, getAllSMMs,
  getAllGraphicDesigners, getUserById,
  updateUser, changeUserPassword,
  toggleUserStatus, deleteUser
} = require("../controllers/admin/userManagement.controller");

const auth            = require("../middleware/auth.middleware");
const isAdmin          = require("../middleware/isAdmin.middleware");
const isAdminOrSMM    = require("../middleware/isAdminOrSMM.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");

// ─────────────────────────────────────────
// SHARED READ-ONLY ROUTES (Agency + SMM)
// SMM ko project banate waqt dropdown chahiye
// ─────────────────────────────────────────
router.get("/clients",           auth, checkUserActive, isAdminOrSMM, getAllClients);
router.get("/graphic-designers", auth, checkUserActive, isAdminOrSMM, getAllGraphicDesigners);


// ─────────────────────────────────────────
// AGENCY-ONLY ROUTES (baaki sab)
// ─────────────────────────────────────────
router.use(auth, isAdmin);

router.get("/",                      getAllUsers);
router.get("/smm",                   getAllSMMs);
router.get("/:id",                   getUserById);
router.put("/:id",                   updateUser);
router.put("/:id/change-password",   changeUserPassword);
router.patch("/:id/toggle-status",   toggleUserStatus);
router.delete("/:id",                deleteUser);


module.exports = router;

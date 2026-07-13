// ==========================================
// FILE: src/routes/adminAuth.routes.js
// UPDATED v18: Admin model + Admin login pura hata diya gaya.
//   Agency hi ab "admin" hai — login /api/agency/login se hota hai,
//   forgot-password bhi /api/agency/* routes se hota hai.
//   Ye file ab sirf Agency ke dashboard/profile/workspace routes rakhti hai
//   (URL paths same rakhe hain taaki frontend na tootein: /api/admin/...)
// ==========================================

const router = require("express").Router();

// ================= PROFILE CONTROLLERS (Agency model use karte hain) =================
const {
  getAdminProfile, updateAdminProfile,
  uploadProfileImage, removeProfileImage, changeAdminPassword
} = require("../controllers/admin/profile.controller");

// ================= WORKSPACE CONTROLLERS =================
const {
  getWorkspace, updateWorkspace, uploadAgencyLogo, removeAgencyLogo
} = require("../controllers/admin/workspace.controller");

// ================= DASHBOARD CONTROLLER =================
const { getAdminDashboard } = require("../controllers/admin/dashboard.controller");

// ================= MIDDLEWARE =================
const auth    = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/isAdmin.middleware");
const upload  = require("../middleware/upload.middleware");


// =====================================
// Sab routes protected hain — login /api/agency/login se hoga,
// us token (role: "admin", id: Agency._id) se yahan access milega
// =====================================
router.use(auth, isAdmin);


// =====================================
// DASHBOARD
// GET /api/admin/dashboard
// =====================================
router.get("/dashboard", getAdminDashboard);


// =====================================
// PROFILE ROUTES
// =====================================
router.get("/profile",         getAdminProfile);
router.put("/profile",         updateAdminProfile);
router.put("/change-password", changeAdminPassword);

router.post(
  "/profile/image",
  upload.single("profileImage"),
  uploadProfileImage
);
router.delete("/profile/image", removeProfileImage);


// =====================================
// WORKSPACE ROUTES
// =====================================
router.get("/workspace", getWorkspace);
router.put("/workspace", updateWorkspace);

router.post(
  "/workspace/logo",
  upload.single("agencyLogo"),
  uploadAgencyLogo
);
router.delete("/workspace/logo", removeAgencyLogo);


module.exports = router;

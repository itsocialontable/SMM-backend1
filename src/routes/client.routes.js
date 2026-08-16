// FILE: src/routes/client.routes.js

const router = require("express").Router();

const {
  getClientDashboard,
  getMyProjects, getProjectDetail, reviewDesign,
  getContentCalendar,
  getProfile, updateProfile,
  uploadProfileImage, removeProfileImage,
  getNotifications
} = require("../controllers/client/client.controller");

const auth            = require("../middleware/auth.middleware");
const role            = require("../middleware/role.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");
const upload           = require("../middleware/upload.middleware");

// Sab routes ke liye: login + active + Client role
router.use(auth, checkUserActive, role(["Client"]));

// Dashboard
router.get("/dashboard", getClientDashboard);

// Profile
router.get("/profile",  getProfile);
router.put("/profile",  updateProfile);
router.post("/profile/image",   upload.single("profileImage"), uploadProfileImage);
router.delete("/profile/image", removeProfileImage);

// Design Projects
router.get("/design-projects",            getMyProjects);
router.get("/design-projects/:id",        getProjectDetail);
router.patch("/design-projects/:id/review", reviewDesign);  // Option B — approve/reject

// Content Calendar
router.get("/content-calendar", getContentCalendar);

// Notifications
router.get("/notifications", getNotifications);

module.exports = router;
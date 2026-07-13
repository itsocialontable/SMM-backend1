// ==========================================
// FILE: src/routes/smm.routes.js
// FIXED v19:
//   - SMM ke liye /clients aur /smm-list routes added
//     (apni agency ke clients aur SMMs ki list dekh sake)
//   - Garbage role middleware code removed from dashboard controller
// ==========================================

const router = require("express").Router();

const {
  createProject, getAllProjects, getProjectDetail,
  updateProject, deleteProject, requestRevision,
  addComment, getComments
} = require("../controllers/smm/smm.designProject.controller");

const {
  getSmmDashboard, smmReviewProject
} = require("../controllers/smm/smm.dashboard.controller");

// ✅ NEW v19: SMM ko apni agency ke users ki list ke liye
const {
  getAllClients, getAllSMMs, getAllGraphicDesigners
} = require("../controllers/admin/userManagement.controller");

const auth            = require("../middleware/auth.middleware");
const role            = require("../middleware/role.middleware");
const upload          = require("../middleware/upload.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");

// All SMM routes require: valid token + active user + SMM role
router.use(auth, checkUserActive, role(["SMM"]));

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", getSmmDashboard);

// ── User Lists (SMM apni agency ke users dekh sake) ─────────────────────────
// resolveAgencyId() SMM ke agencyId se sahi data nikalta hai
router.get("/clients",           getAllClients);
router.get("/graphic-designers", getAllGraphicDesigners);
router.get("/smm-list",          getAllSMMs);

// ── Design Projects CRUD ─────────────────────────────────────────────────────
router.get("/design-projects",                            getAllProjects);
router.post("/design-projects", upload.array("assets", 10), createProject);
router.get("/design-projects/:id",                        getProjectDetail);
router.put("/design-projects/:id",                        updateProject);
router.delete("/design-projects/:id",                     deleteProject);

// ── SMM Review (GD ne submit kiya → SMM approve/reject) ─────────────────────
router.patch("/design-projects/:id/smm-review", smmReviewProject);

// ── Revisions + Comments ─────────────────────────────────────────────────────
router.post("/design-projects/:id/revisions", requestRevision);
router.get("/design-projects/:id/comments",   getComments);
router.post("/design-projects/:id/comments",  addComment);

module.exports = router;

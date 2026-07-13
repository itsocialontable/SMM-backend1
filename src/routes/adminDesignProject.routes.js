// ==========================================
// FILE: src/routes/adminDesignProject.routes.js
// Admin sirf dekh sakta hai — read only
// ==========================================

const router = require("express").Router();

const {
  getAllProjects,
  getProjectDetail
} = require("../controllers/admin/designProject.controller");

const auth    = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/isAdmin.middleware");

router.use(auth, isAdmin);

// GET /api/admin/design-projects        → saare projects dekho
// GET /api/admin/design-projects/:id    → single project detail
router.get("/",    getAllProjects);
router.get("/:id", getProjectDetail);

module.exports = router;

// ==========================================
// FILE: src/routes/adminDesignProject.routes.js
// UPDATED v20: Admin ab sirf read-only nahi — create/edit/delete
//   bhi kar sakta hai (SMM jaisi hi CRUD access, apni agency ke
//   projects ke liye).
// ==========================================

const router = require("express").Router();

const {
  getAllProjects,
  getProjectDetail,
  createProject,
  updateProject,
  deleteProject
} = require("../controllers/admin/designProject.controller");

const auth    = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/isAdmin.middleware");
const upload  = require("../middleware/upload.middleware");

router.use(auth, isAdmin);

// GET /api/admin/design-projects        → saare projects dekho
// GET /api/admin/design-projects/:id    → single project detail
router.get("/",    getAllProjects);
router.get("/:id", getProjectDetail);

// POST /api/admin/design-projects       → naya project create + designer assign
router.post("/", upload.array("assets", 10), createProject);

// PUT /api/admin/design-projects/:id    → project edit
router.put("/:id", updateProject);

// DELETE /api/admin/design-projects/:id → project delete
router.delete("/:id", deleteProject);

module.exports = router;

// FILE: src/routes/graphicDesigner.routes.js

const router = require("express").Router();

const {
  getDashboard, getProjects, getProjectDetails,
  updateProgress, getDeadlines
} = require("../controllers/graphicDesigner/gd.dashboard.controller");

const {
  submitForReview,
  uploadDesignFile, getProjectFiles,
  replyToRevision, uploadRevisionDesign,
  addComment, getComments
} = require("../controllers/graphicDesigner/gd.work.controller");

const {
  getProfile, updateProfile,
  uploadProfileImage, removeProfileImage
} = require("../controllers/graphicDesigner/gd.profile.controller");

const auth            = require("../middleware/auth.middleware");
const role            = require("../middleware/role.middleware");
const upload          = require("../middleware/upload.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");

router.use(auth, checkUserActive, role(["Graphic Designer"]));

// Profile
router.get("/profile",              getProfile);
router.put("/profile",              updateProfile);
router.post("/profile/image",       upload.single("profileImage"), uploadProfileImage);
router.delete("/profile/image",     removeProfileImage);

// Dashboard
router.get("/dashboard",            getDashboard);

// Deadlines — specific route pehle
router.get("/projects/deadlines",   getDeadlines);

// Projects
router.get("/projects",             getProjects);
router.get("/projects/:id",         getProjectDetails);
router.put("/projects/:id/progress", updateProgress);

// ✅ Submit for Review — GD ka main action
router.patch("/projects/:id/submit-for-review", submitForReview);

// Files
router.get("/projects/:id/files",   getProjectFiles);
router.post("/projects/:id/files",  upload.single("designFile"), uploadDesignFile);

// Comments
router.get("/projects/:id/comments",  getComments);
router.post("/projects/:id/comments", addComment);

// Revisions
router.put("/revisions/:revisionId/reply",          replyToRevision);
router.post("/revisions/:revisionId/upload",         upload.single("updatedDesign"), uploadRevisionDesign);

module.exports = router;

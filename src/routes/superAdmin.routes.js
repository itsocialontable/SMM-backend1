// ==========================================
// FILE: src/routes/superAdmin.routes.js
// UPDATED v16: activateSubscription route added
// ==========================================

const router = require("express").Router();

const { registerSuperAdmin, loginSuperAdmin } = require("../controllers/superAdmin/superAdminAuth.controller");
const {
  createAgency, getAllAgencies, getAgencyById,
  updateAgency, toggleAgencyStatus, deleteAgency,
  activateSubscription
} = require("../controllers/superAdmin/superAdminAgency.controller");

const auth         = require("../middleware/auth.middleware");
const isSuperAdmin = require("../middleware/isSuperAdmin.middleware");

// PUBLIC
router.post("/register", registerSuperAdmin);
router.post("/login",    loginSuperAdmin);

// PROTECTED
router.use(auth, isSuperAdmin);

router.post("/agencies/create",                    createAgency);
router.get("/agencies",                            getAllAgencies);
router.get("/agencies/:id",                        getAgencyById);
router.put("/agencies/:id",                        updateAgency);
router.patch("/agencies/:id/toggle-status",        toggleAgencyStatus);
router.patch("/agencies/:id/activate-subscription", activateSubscription);
router.delete("/agencies/:id",                     deleteAgency);

module.exports = router;

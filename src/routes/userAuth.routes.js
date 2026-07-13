// ==========================================
// FILE: src/routes/userAuth.routes.js
// UPDATED v16: Trial client/team member limits added
// ==========================================

const router = require("express").Router();
const { createUser, loginUser } = require("../controllers/users/userAuth.controller");

const auth             = require("../middleware/auth.middleware");
const isAdmin          = require("../middleware/isAdmin.middleware");
const checkUserActive  = require("../middleware/checkUserActive.middleware");
const { checkSubscription, checkTrialClientLimit, checkTrialTeamMemberLimit } = require("../middleware/subscription.middleware");

// POST /api/user/login  (public)
router.post("/login", loginUser);

// POST /api/user/create  (admin only)
// Add subscription check + dynamic limit check based on role in body
router.post(
  "/create",
  auth,
  checkUserActive,
  isAdmin,
  checkSubscription,
  // Dynamic limit: check client OR team-member limit based on req.body.role
  async (req, res, next) => {
    const { role } = req.body;
    if (role === "Client") {
      return require("../middleware/subscription.middleware").checkTrialClientLimit(req, res, next);
    }
    if (role === "SMM" || role === "Graphic Designer") {
      return require("../middleware/subscription.middleware").checkTrialTeamMemberLimit(req, res, next);
    }
    next();
  },
  createUser
);

module.exports = router;

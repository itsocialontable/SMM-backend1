// ==========================================
// FILE: src/routes/adminAnalytics.routes.js
// NEW (ADD-ON): Admin analytics routes — admin (agency) only
// Mounted at /api/admin/analytics in app.js
// ==========================================

const router = require("express").Router();

const {
  getAdminAnalyticsOverview,
  getAdminRevenueOverview
} = require("../controllers/admin/analytics.controller");

const auth    = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/isAdmin.middleware");

router.use(auth, isAdmin);

// GET /api/admin/analytics/overview?period=weekly|monthly|yearly&clientId=&smmId=
// → agency-wide post analytics (likes/comments/shares/views/reach/
//   impressions/engagement/profileViews) + weekly/monthly/yearly trend
router.get("/overview", getAdminAnalyticsOverview);

// GET /api/admin/analytics/revenue?period=weekly|monthly|yearly&status=
// → real revenue overview (Invoice collection se) + weekly/monthly/yearly trend
router.get("/revenue", getAdminRevenueOverview);

module.exports = router;

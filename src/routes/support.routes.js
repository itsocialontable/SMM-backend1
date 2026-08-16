// ==========================================
// FILE: src/routes/support.routes.js
// NEW: Help & Support contact form route
// ==========================================

const router = require("express").Router();

const { submitSupportRequest } = require("../controllers/support/support.controller");

const auth            = require("../middleware/auth.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");

// Koi bhi logged-in, active user (Client/SMM/GD) use kar sakta hai
router.use(auth, checkUserActive);

router.post("/contact", submitSupportRequest);

module.exports = router;
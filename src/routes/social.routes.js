// ==========================================
// FILE: src/routes/social.routes.js
// FIXED: checkUserActive + SMM role add kiya
// ==========================================

const router = require("express").Router();

const auth            = require("../middleware/auth.middleware");
const role            = require("../middleware/role.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");

const { getAuthUrl, connectAccount }  = require("../controllers/social/connect.controller");
const { getAccounts }                 = require("../controllers/social/getAccounts.controller");
const { disconnectAccount }           = require("../controllers/social/disconnectAccount.controller");

// ---- Sab routes ke liye: login + active + SMM ya Agency role ----
// FIXED v18: Agency ka actual JWT role "admin" hota hai (Agency model
// ka default role), "Agency"/"agency" string kabhi nahi aati — pehle
// yahan galat string check hone se Agency hamesha 403 paata tha
router.use(auth, checkUserActive, role(["SMM", "admin"]));

// ================= SOCIAL ACCOUNT CONNECT =================
router.get("/auth/:platform", getAuthUrl);
router.post("/connect",       connectAccount);

// ================= ACCOUNTS =================
router.get("/accounts",             getAccounts);
router.delete("/disconnect/:id",    disconnectAccount);

module.exports = router;

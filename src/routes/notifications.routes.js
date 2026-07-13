// ==========================================
// FILE: src/routes/notifications.routes.js
// FIXED: proper auth + all CRUD routes
// ==========================================

const router = require("express").Router();

const {
  getNotifications, markAsRead,
  markAllAsRead,    deleteNotification
} = require("../controllers/notifications/notification.controller");

const auth            = require("../middleware/auth.middleware");
const checkUserActive = require("../middleware/checkUserActive.middleware");

// Sab routes ke liye login + active check
router.use(auth, checkUserActive);

// GET    /api/notifications              → apni notifications
// GET    /api/notifications?unreadOnly=true
router.get("/",              getNotifications);

// PATCH  /api/notifications/read-all    → sab read mark karo
router.patch("/read-all",    markAllAsRead);

// PATCH  /api/notifications/:id/read    → ek read mark karo
router.patch("/:id/read",    markAsRead);

// DELETE /api/notifications/:id         → delete karo
router.delete("/:id",        deleteNotification);

module.exports = router;

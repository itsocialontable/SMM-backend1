// ==========================================
// FILE: src/controllers/notifications/notification.controller.js
// FIXED: Socket.io dependency hatai — sirf DB notifications
// GET  /api/notifications
// PATCH /api/notifications/:id/read
// PATCH /api/notifications/read-all
// DELETE /api/notifications/:id
// ==========================================

const Notification = require("../../models/notification.model");


// =====================================
// 1. GET MY NOTIFICATIONS
// GET /api/notifications?page=1&limit=10&unreadOnly=true
// =====================================

exports.getNotifications = async (req, res) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page)  || 1);
    const limit     = Math.min(50, parseInt(req.query.limit) || 10);
    const skip      = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === "true";

    const filter = { userId: req.user.id };
    if (unreadOnly) filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user.id, isRead: false })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 2. MARK SINGLE NOTIFICATION AS READ
// PATCH /api/notifications/:id/read
// =====================================

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, msg: "Notification not found" });
    }

    return res.status(200).json({ success: true, msg: "Marked as read" });

  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 3. MARK ALL AS READ
// PATCH /api/notifications/read-all
// =====================================

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({ success: true, msg: "Saari notifications read mark ho gayi" });

  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 4. DELETE SINGLE NOTIFICATION
// DELETE /api/notifications/:id
// =====================================

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id:    req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ success: false, msg: "Notification not found" });
    }

    return res.status(200).json({ success: true, msg: "Notification deleted" });

  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

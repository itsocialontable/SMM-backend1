// ==========================================
// FILE: src/utils/sendNotification.utils.js
// DB notification save + Email send dono
// UPDATED v18: userId User2 ka ho ya Agency ka — dono ke liye email
//   lookup kaam karega (pehle sirf User2 check hota tha, Agency ke
//   liye email silently skip ho jaata tha)
// ==========================================

const Notification = require("../models/notification.model");
const User2        = require("../models/user2.model");
const Agency        = require("../models/agency.model");
const sendEmail    = require("./email.util");

const sendNotification = async ({
  userId,
  type       = "INFO",
  event,
  title,
  message,
  projectId  = null,
  // Extra data for email template
  templateData = {}
}) => {
  try {
    // ── 0. Recipient User2 hai ya Agency, dono check karo ───────────────
    let recipient   = await User2.findById(userId).select("name email").lean();
    let ownerType   = "User2";
    if (!recipient) {
      recipient = await Agency.findById(userId).select("name email").lean();
      ownerType = "Agency";
    }

    // ── 1. DB me save karo (existing flow) ──────────────────────────────
    const notification = await Notification.create({
      userId, ownerType, type, event, title, message, projectId
    });

    if (recipient?.email) {
      // Fire and forget — await nahi karte taaki main flow na ruke
      sendEmail({
        to:           recipient.email,
        name:         recipient.name,
        event,
        templateData: { ...templateData, title, message }
      }).catch(err => console.error("sendNotification email error:", err.message));
    }

    return notification;

  } catch (error) {
    console.error("SEND NOTIFICATION ERROR =>", error.message);
    return null;
  }
};

module.exports = sendNotification;

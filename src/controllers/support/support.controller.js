// ==========================================
// FILE: src/controllers/support/support.controller.js
// NEW: Help & Support contact form — Client/SMM/GD apni agency ke
//   admin ko seedha email bhej sakte hain (form fill karke submit).
// ==========================================

const User2     = require("../../models/user2.model");
const Agency    = require("../../models/agency.model");
const sendEmail = require("../../utils/email.util");

// =====================================
// SUBMIT SUPPORT / CONTACT REQUEST
// POST /api/support/contact
// Body: { subject, message }
// Roles: Client, SMM, Graphic Designer (koi bhi login user)
// =====================================
exports.submitSupportRequest = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, msg: "Subject is required" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, msg: "Message is required" });
    }

    // Sender (jo form fill kar raha hai) ka record nikalo
    const sender = await User2.findById(req.user.id).select("name email role agencyId").lean();
    if (!sender) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (!sender.agencyId) {
      return res.status(400).json({ success: false, msg: "No agency linked to this account" });
    }

    // Us agency ka admin/owner nikalo — usi ko mail jayegi
    const agency = await Agency.findById(sender.agencyId).select("name email").lean();
    if (!agency || !agency.email) {
      return res.status(404).json({ success: false, msg: "Agency admin contact not found" });
    }

    // Email bhejo — ab dedicated "support_request" template use hota hai
    // (pehle generic "default" template use ho raha tha)
    const emailSent = await sendEmail({
      to:    agency.email,
      name:  agency.name || "Team",
      event: "support_request",
      templateData: {
        senderName:  sender.name,
        senderRole:  sender.role,
        senderEmail: sender.email,
        subject:     subject.trim(),
        message:     message.trim().replace(/\n/g, "<br>")
      }
    });

    if (!emailSent) {
      return res.status(502).json({ success: false, msg: "Failed to send email. Please try again later." });
    }

    return res.status(200).json({
      success: true,
      msg: "Your support request has been sent successfully"
    });

  } catch (error) {
    console.error("SUPPORT REQUEST ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};
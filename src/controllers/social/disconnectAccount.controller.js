// ==========================================
// FILE: src/controllers/social/disconnectAccount.controller.js
// UPDATED v18:
//   - accessToken/refreshToken ko null karne ki jagah "" (empty string)
//     kiya — model me accessToken `required: true` hai aur null us
//     validation ko fail karta tha (Mongoose required validator empty
//     string ko allow karta hai, null/undefined ko nahi) — isliye
//     disconnect hamesha 500 error deta tha, ab sahi se kaam karega
//   - sendNotification ka call signature fix kiya (object form)
//   - event "account_disconnected" — ab Notification enum me hai
// ==========================================

const SocialAccount    = require("../../models/socialAccount.model");
const sendNotification = require("../../utils/sendNotification.utils");

exports.disconnectAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const account = await SocialAccount.findOne({ _id: id, user: req.user.id });

    if (!account) {
      return res.status(404).json({ success: false, msg: "Social account not found" });
    }

    account.isActive     = false;
    account.accessToken   = "";   // required:true ko satisfy karta hai, "" empty rehta hai
    account.refreshToken  = "";
    await account.save();

    const io = req.app.get("io");
    await sendNotification({
      io,
      userId:  req.user.id,
      type:    "info",
      event:   "account_disconnected",
      title:   "Account Disconnected",
      message: `${account.platform} account disconnected successfully`
    });

    return res.status(200).json({
      success: true,
      msg: `${account.platform} account disconnected successfully`
    });

  } catch (error) {
    console.error("DISCONNECT ACCOUNT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

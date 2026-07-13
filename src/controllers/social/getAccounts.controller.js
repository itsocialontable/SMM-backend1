// ==========================================
// FILE: src/controllers/social/getAccounts.controller.js
// UPDATED v18: SMM apne liye account connect nahi karta — har account
//   hamesha kisi client se linked hota hai. Isliye SMM ke liye default
//   (?clientId nahi diya) ab "saare clients ke accounts" dikhata hai,
//   "SMM ka apna account (client: null)" ka case ab exist nahi karta.
//   Agar ?clientId diya hai to ownership validate hoti hai (apni
//   agency ka client hai ya nahi).
// ==========================================

const SocialAccount = require("../../models/socialAccount.model");
const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

exports.getAccounts = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, msg: "Unauthorized user" });
    }

    const { clientId } = req.query;

    const query = { user: req.user.id, isActive: true };

    if (clientId) {
      // Specific client ke accounts — ownership validate karo
      if (req.user.role === "SMM") {
        const check = await validateClientForSmm(req.user.id, clientId);
        if (!check.valid) {
          return res.status(400).json({ success: false, msg: check.reason });
        }
      }
      query.client = clientId;
    }
    // clientId na diya ho to: SMM ke saare clients ke connected
    // accounts (koi extra filter nahi) — kyunki ab "SMM ka apna
    // personal account" ka concept exist nahi karta.

    const accounts = await SocialAccount.find(query)
      .select("-accessToken -refreshToken")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      msg: accounts.length
        ? "Connected accounts fetched successfully"
        : "No connected accounts found",
      data: accounts
    });

  } catch (error) {
    console.error("getAccounts error:", error);
    return res.status(500).json({
      success: false,
      msg: "Server error while fetching accounts"
    });
  }
};

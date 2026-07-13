// ==========================================
// FILE: src/utils/validateClientForSmm.util.js
// NEW v18: Platform ka core rule — SMM apne LIYE social account connect
//   ya post publish NAHI karta. SMM hamesha apni agency ke ek CLIENT
//   ki taraf se (unke credentials/account use karke) post publish
//   karta hai. Isliye har jagah (account connect, post create, draft,
//   publish) clientId MANDATORY hai, aur ye function check karta hai
//   ki:
//     1. wo clientId ek real User2 document hai
//     2. uska role "Client" hai
//     3. uski agencyId SMM ki apni agencyId se MATCH karti hai
//        (taaki ek SMM doosri agency ke client ke liye kabhi
//        account connect ya post publish na kar sake)
// ==========================================

const User2 = require("../models/user2.model");

/**
 * @param {string} smmUserId - req.user.id (logged-in SMM)
 * @param {string} clientId  - body/query se aaya clientId
 * @returns {Promise<{ valid: boolean, reason?: string, client?: object, smmAgencyId?: string }>}
 */
async function validateClientForSmm(smmUserId, clientId) {
  if (!clientId) {
    return { valid: false, reason: "clientId is required — SMM hamesha ek client ki taraf se post/account manage karta hai" };
  }

  const smm = await User2.findById(smmUserId).select("agencyId role").lean();
  if (!smm || !smm.agencyId) {
    return { valid: false, reason: "SMM ka agencyId nahi mila — agency se contact karo" };
  }

  const client = await User2.findById(clientId).select("agencyId role name email").lean();
  if (!client) {
    return { valid: false, reason: "Client not found" };
  }

  if (client.role !== "Client") {
    return { valid: false, reason: "Given ID kisi Client ka nahi hai" };
  }

  if (String(client.agencyId) !== String(smm.agencyId)) {
    return { valid: false, reason: "Ye client aapki agency ka nahi hai — access denied" };
  }

  return { valid: true, client, smmAgencyId: smm.agencyId };
}

module.exports = { validateClientForSmm };

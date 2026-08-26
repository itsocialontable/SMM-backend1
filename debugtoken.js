// ==========================================
// DEBUG SCRIPT — sirf testing ke liye, production me mat rakhna.
// Iska kaam: DB me saved kisi bhi ek Instagram/Facebook account ka
// accessToken nikaal ke decrypt karega aur check karega ki result
// ek valid-looking token jaisa dikh raha hai ya garbage.
//
// CHALANE KA TARIKA (apne backend folder ke andar se):
//   node debug-token.js
//
// (isko src/ ke bahar ya andar kahin bhi rakh sakte ho, bas paths
// niche sahi rakhna — agar backend root me rakho to ye paths already
// sahi hain)
// ==========================================

require("dotenv").config();
const mongoose = require("mongoose");
const { decrypt } = require("./src/utils/encrypt.util");
const SocialAccount = require("./src/models/socialAccount.model");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ DB connected\n");

  // Instagram ka ek active account utha rahe hain (jiska token abhi
  // fail ho raha tha) — .select("+accessToken") zaroori hai kyunki
  // ye field select:false ho sakta hai schema me.
  const account = await SocialAccount
    .findOne({ platform: "instagram", isActive: true })
    .select("+accessToken +refreshToken");

  if (!account) {
    console.log("❌ Koi active Instagram account nahi mila DB me.");
    process.exit(0);
  }

  console.log("Account ID:", account._id.toString());
  console.log("Platform:", account.platform);
  console.log("Raw accessToken field (DB me jaisa stored hai), pehle 40 chars:");
  console.log("  ", (account.accessToken || "").slice(0, 40), "...\n");

  try {
    const decrypted = decrypt(account.accessToken);
    console.log("Decrypted token length:", decrypted.length);
    console.log("Decrypted token (pehle 15 + aakhri 5 chars):");
    console.log("  ", decrypted.slice(0, 15) + "..." + decrypted.slice(-5));

    // Facebook/Instagram long-lived tokens aam taur pe "EAA" se
    // shuru hote hain — agar ye nahi milta to decrypt fail/garbage hai
    if (decrypted.startsWith("EAA")) {
      console.log("\n✅ Decrypted token Facebook/Instagram token jaisa dikh raha hai (EAA se start hota hai). Decrypt sahi kaam kar raha hai.");
    } else if (decrypted.length === 0) {
      console.log("\n❌ Decrypt EMPTY string de raha hai — matlab SECRET_KEY mismatch ya stored ciphertext corrupt hai.");
    } else {
      console.log("\n⚠️  Decrypt kuch return kar raha hai lekin 'EAA' se start nahi ho raha — ho sakta hai ye kisi doosre format ka token ho, ya corrupt ho. Isko dhyan se dekho.");
    }
  } catch (err) {
    console.log("\n❌ Decrypt karte waqt hi crash ho gaya:", err.message);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Script error:", err.message);
  process.exit(1);
});
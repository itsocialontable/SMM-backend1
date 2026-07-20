// // ==========================================
// // FILE: src/controllers/social/connect.controller.js
// // UPDATED v18:
// //   - sendNotification() ab sahi object-signature se call hota hai
// //     (pehle io ko positional arg ki tarah pass kiya jaata tha,
// //     jisse notification kabhi DB me save hi nahi hoti thi)
// //   - "account_connected" event ab Notification model ke enum me
// //     valid hai (pehle silently fail hota tha)
// //   - ownerType set hota hai (User2 ya Agency) — jo connect kar
// //     raha hai, refPath se sahi populate hoga
// //   - FACEBOOK: ab sirf personal profile id save nahi hota — Page
// //     list (/me/accounts) fetch karke Page id + Page access token
// //     save hota hai (Graph API sirf Pages par posting allow karta
// //     hai, personal profile par nahi)
// //   - INSTAGRAM: Page ke through linked Instagram Business Account
// //     dhoondha jaata hai (instagram_business_account field) — pehle
// //     yeh kabhi fetch hi nahi hota tha, sirf FB profile id save ho
// //     raha tha jisse publish karna structurally namumkin tha
// //   - Multiple pages hone par optional `pageId` body param se
// //     specific page choose ki ja sakti hai, warna pehla page default
// // ==========================================

// const SocialAccount    = require("../../models/socialAccount.model");
// const axios            = require("axios");
// const crypto           = require("crypto");
// const OAUTH_CONFIG     = require("../../config/oauth.config");
// const { encrypt }      = require("../../utils/encrypt.util");
// const sendNotification = require("../../utils/sendNotification.utils");
// const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

// // =====================================================
// // GET AUTH URL
// // v18: SMM role ke liye clientId MANDATORY hai — SMM apne liye
// // account connect nahi karta, hamesha apni agency ke kisi client
// // ki taraf se (client se credentials/permission lekar) karta hai.
// // Agency (admin) khud ke liye bina clientId ke bhi connect kar
// // sakti hai.
// // =====================================================
// exports.getAuthUrl = async (req, res) => {
//   const { platform } = req.params;
//   const { clientId, source } = req.query;

//   const config = OAUTH_CONFIG[platform];
//   if (!config) {
//     return res.status(400).json({ success: false, msg: "Invalid platform" });
//   }

//   if (req.user.role === "SMM") {
//     const check = await validateClientForSmm(req.user.id, clientId);
//     if (!check.valid) {
//       return res.status(400).json({ success: false, msg: check.reason });
//     }
//   }

//   // v20: mobile app se aane wala request pehchan-ne ke liye marker.
//   // App apna auth URL request karte waqt ?source=app bhejta hai — ye
//   // state ke andar save ho jaata hai (tamper-safe nahi, sirf routing
//   // hint hai) taaki /auth/callback pe pata chal sake user browser
//   // (website) se aaya tha ya app (webview) se, aur us hisaab se
//   // sahi jagah redirect kiya ja sake.
//   const statePayload = {
//     userId: req.user.id,
//     platform,
//     time: Date.now(),
//     ...(clientId ? { clientId } : {}),
//     ...(source === "app" ? { source: "app" } : {})
//   };

//   const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

//   let url =
//     `${config.authUrl}?` +
//     `response_type=code` +
//     `&client_id=${config.clientId}` +
//     `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
//     `&scope=${encodeURIComponent(config.scope)}` +
//     `&state=${state}`;

//   if (platform === "twitter") {
//     const codeVerifier = crypto.randomBytes(32).toString("base64url");
//     const codeChallenge = crypto
//       .createHash("sha256")
//       .update(codeVerifier)
//       .digest("base64url");

//     const twitterUrl =
//       `${config.authUrl}?` +
//       `response_type=code` +
//       `&client_id=${config.clientId}` +
//       `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
//       `&scope=${encodeURIComponent(config.scope)}` +
//       `&state=${state}` +
//       `&code_challenge=${codeChallenge}` +
//       `&code_challenge_method=S256`;

//     return res.json({ success: true, url: twitterUrl, codeVerifier });
//   }

//   if (platform === "youtube" || platform === "google") {
//     url += `&access_type=offline&prompt=consent`;
//   }

//   return res.json({ success: true, url });
// };


// // =====================================================
// // CONNECT ACCOUNT
// // =====================================================
// exports.connectAccount = async (req, res) => {
//   try {
//     const {
//       platform,
//       code,
//       state,
//       codeVerifier,
//       redirectUri: clientRedirectUri,
//       pageId         // optional — Facebook/Instagram me multiple pages hone par
//     } = req.body;

//     if (!platform || !code || !state) {
//       return res.status(400).json({
//         success: false,
//         msg: "platform, code, state required"
//       });
//     }

//     if (platform === "twitter" && !codeVerifier) {
//       return res.status(400).json({
//         success: false,
//         msg: "codeVerifier required for Twitter"
//       });
//     }

//     // ─── Decode & verify state ────────────────────────────────────
//     let decoded;
//     try {
//       const normalized = state.replace(/-/g, "+").replace(/_/g, "/");
//       decoded = JSON.parse(Buffer.from(normalized, "base64").toString());
//     } catch {
//       return res.status(400).json({ success: false, msg: "Invalid state" });
//     }

//     if (decoded.userId !== req.user.id) {
//       return res.status(401).json({ success: false, msg: "State mismatch" });
//     }

//     const targetClientId = decoded.clientId || null;

//     // ── v18: state base64-encoded hai, cryptographically signed nahi —
//     // isliye clientId yahan SERVER-SIDE dobara validate karna zaroori
//     // hai (warna koi SMM state tamper karke doosri agency ke client
//     // ke naam pe account connect kar sakta tha)
//     if (req.user.role === "SMM") {
//       const check = await validateClientForSmm(req.user.id, targetClientId);
//       if (!check.valid) {
//         return res.status(400).json({ success: false, msg: check.reason });
//       }
//     }

//     const config = OAUTH_CONFIG[platform];
//     if (!config) {
//       return res.status(400).json({ success: false, msg: "Invalid platform" });
//     }

//     const usedRedirectUri = clientRedirectUri || config.redirectUri;

//     let accessToken, refreshToken = null, expiresIn;
//     let accountId, accountName, profileImage = "";

//     // =====================================================
//     // FACEBOOK
//     // v21: PEHLE sirf EK Page save hoti thi (pageId diya ho to wahi,
//     //   warna pages[0] — user ko pata hi nahi chalta tha post kis Page
//     //   pe gaya). AB — user jitne bhi Facebook Pages manage karta hai,
//     //   SAB ko alag-alag SocialAccount documents ke roop me save kiya
//     //   jaata hai (isi client ke naam). Post banate waqt frontend
//     //   `GET /api/social/accounts?clientId=X&platform=facebook` call
//     //   karke saari connected Pages ki list dikha sakta hai — user
//     //   wahan se specific Page select karega, uski accountId
//     //   post.platformAccounts array me bhejegi.
//     // =====================================================
//     if (platform === "facebook") {
//       try {
//         const tokenRes = await axios.get(config.tokenUrl, {
//           params: {
//             client_id:     config.clientId,
//             client_secret: config.clientSecret,
//             redirect_uri:  usedRedirectUri,
//             code
//           }
//         });

//         const userAccessToken = tokenRes.data?.access_token;
//         if (!userAccessToken) {
//           return res.status(400).json({
//             success: false,
//             msg: "Facebook token missing",
//             raw: tokenRes.data
//           });
//         }

//         // Graph API sirf Pages par publish allow karta hai — personal
//         // profile par direct posting bohot saal pehle band kar di gayi thi.
//         const pagesRes = await axios.get("https://graph.facebook.com/v18.0/me/accounts", {
//           params: { access_token: userAccessToken, fields: "id,name,access_token,picture" }
//         });

//         let pages = pagesRes.data?.data || [];
//         if (!pages.length) {
//           return res.status(400).json({
//             success: false,
//             msg: "No Facebook Page found for this account. Publishing requires a connected Facebook Page (personal profiles can't be posted to via API)."
//           });
//         }

//         // Agar frontend ne specifically ek pageId bheja hai (jaise
//         // "sirf isi Page ko reconnect/refresh karo"), to sirf wahi
//         // process karo. Warna default: SAARI Pages save karo.
//         if (pageId) {
//           pages = pages.filter(p => p.id === pageId);
//         }

//         const ownerType = (req.user.role === "admin" || req.user.role === "Admin") ? "Agency" : "User2";
//         const savedAccounts = [];

//         for (const page of pages) {
//           const pageExpiresIn = tokenRes.data?.expires_in || null;

//           const saved = await SocialAccount.findOneAndUpdate(
//             { user: req.user.id, platform: "facebook", accountId: page.id, client: targetClientId },
//             {
//               user:     req.user.id,
//               ownerType,
//               client:   targetClientId,
//               platform: "facebook",
//               accountName:  page.name,
//               accountId:    page.id,
//               accessToken:  encrypt(page.access_token), // Page access token — isi se posting hoti hai
//               refreshToken: null,
//               profileImage: page.picture?.data?.url || "",
//               isActive:     true,
//               connectedAt:  new Date(),
//               tokenExpiresAt: pageExpiresIn ? new Date(Date.now() + pageExpiresIn * 1000) : null
//             },
//             { upsert: true, returnDocument: "after", new: true }
//           );

//           savedAccounts.push(saved);
//         }

//         const io = req.app.get("io");
//         await sendNotification({
//           io,
//           userId: req.user.id,
//           type: ownerType === "Agency" ? "Agency" : "User2",
//           event: "account_connected",
//           title: "Account Connected",
//           message: `Facebook — ${savedAccounts.length} Page${savedAccounts.length > 1 ? "s" : ""} connected successfully${targetClientId ? " (for client)" : ""}`
//         });

//         // Facebook ke liye yahin response bhej do — neeche wala generic
//         // single-account "SAVE TO DB" block skip ho jaayega.
//         return res.status(200).json({
//           success: true,
//           msg: `${savedAccounts.length} Facebook Page${savedAccounts.length > 1 ? "s" : ""} connected successfully`,
//           forClient: targetClientId || null,
//           data: savedAccounts
//         });

//       } catch (err) {
//         console.error("FACEBOOK ERROR:", err.response?.data || err.message);
//         return res.status(400).json({
//           success: false,
//           msg: "Facebook OAuth failed",
//           error: err.response?.data
//         });
//       }
//     }

//     // =====================================================
//     // INSTAGRAM (Business account linked to a Facebook Page)
//     // =====================================================
//     else if (platform === "instagram") {
//       try {
//         const tokenRes = await axios.get(config.tokenUrl, {
//           params: {
//             client_id:     config.clientId,
//             client_secret: config.clientSecret,
//             redirect_uri:  usedRedirectUri,
//             code
//           }
//         });

//         const userAccessToken = tokenRes.data?.access_token;
//         if (!userAccessToken) {
//           return res.status(400).json({
//             success: false,
//             msg: "Facebook token missing",
//             raw: tokenRes.data
//           });
//         }

//         const pagesRes = await axios.get("https://graph.facebook.com/v18.0/me/accounts", {
//           params: { access_token: userAccessToken, fields: "id,name,access_token" }
//         });

//         const pages = pagesRes.data?.data || [];
//         if (!pages.length) {
//           return res.status(400).json({
//             success: false,
//             msg: "No Facebook Page found. Instagram publishing requires an Instagram Business/Creator account linked to a Facebook Page."
//           });
//         }

//         // Har page ke liye check karo ki uske saath Instagram Business Account linked hai ya nahi
//         let igAccount = null;
//         let igPageAccessToken = null;

//         for (const page of pages) {
//           if (pageId && page.id !== pageId) continue;

//           const igRes = await axios.get(`https://graph.facebook.com/v18.0/${page.id}`, {
//             params: {
//               fields: "instagram_business_account{id,username,profile_picture_url}",
//               access_token: page.access_token
//             }
//           });

//           if (igRes.data?.instagram_business_account) {
//             igAccount = igRes.data.instagram_business_account;
//             igPageAccessToken = page.access_token;
//             break;
//           }
//         }

//         if (!igAccount) {
//           return res.status(400).json({
//             success: false,
//             msg: "No Instagram Business/Creator account linked to your Facebook Page(s) was found."
//           });
//         }

//         accessToken  = igPageAccessToken; // IG Graph API posting bhi Page access token se hota hai
//         expiresIn    = tokenRes.data?.expires_in || null;
//         accountId    = igAccount.id;
//         accountName  = igAccount.username || "Instagram Account";
//         profileImage = igAccount.profile_picture_url || "";

//       } catch (err) {
//         console.error("INSTAGRAM ERROR:", err.response?.data || err.message);
//         return res.status(400).json({
//           success: false,
//           msg: "Instagram OAuth failed",
//           error: err.response?.data
//         });
//       }
//     }

//     // =====================================================
//     // TWITTER
//     // =====================================================
//     else if (platform === "twitter") {
//       const tokenRes = await axios.post(
//         config.tokenUrl,
//         new URLSearchParams({
//           code,
//           grant_type:    "authorization_code",
//           client_id:     config.clientId,
//           redirect_uri:  usedRedirectUri,
//           code_verifier: codeVerifier
//         }),
//         {
//           headers: { "Content-Type": "application/x-www-form-urlencoded" },
//           auth:    { username: config.clientId, password: config.clientSecret }
//         }
//       );

//       accessToken  = tokenRes.data.access_token;
//       refreshToken = tokenRes.data.refresh_token;
//       expiresIn    = tokenRes.data.expires_in;

//       const userRes = await axios.get("https://api.twitter.com/2/users/me", {
//         headers: { Authorization: `Bearer ${accessToken}` }
//       });

//       accountId   = userRes.data.data.id;
//       accountName = userRes.data.data.name;
//     }

//     // =====================================================
//     // LINKEDIN
//     // =====================================================
//     else if (platform === "linkedin") {
//       const tokenRes = await axios.post(config.tokenUrl, null, {
//         params: {
//           grant_type:    "authorization_code",
//           code,
//           redirect_uri:  usedRedirectUri,
//           client_id:     config.clientId,
//           client_secret: config.clientSecret
//         }
//       });

//       accessToken  = tokenRes.data.access_token;
//       refreshToken = tokenRes.data.refresh_token;
//       expiresIn    = tokenRes.data.expires_in;

//       const userRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
//         headers: { Authorization: `Bearer ${accessToken}` }
//       });

//       accountId    = userRes.data.sub;
//       accountName  = userRes.data.name;
//       profileImage = userRes.data.picture || "";
//     }

//     // =====================================================
//     // YOUTUBE — with refresh token (offline access)
//     // =====================================================
//     else if (platform === "youtube") {
//       let tokenData;
//       try {
//         const tokenRes = await axios.post(
//           config.tokenUrl,
//           new URLSearchParams({
//             code,
//             client_id:     config.clientId,
//             client_secret: config.clientSecret,
//             redirect_uri:  usedRedirectUri,
//             grant_type:    "authorization_code"
//           }),
//           { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//         );
//         tokenData = tokenRes.data;
//       } catch (err) {
//         console.error("YouTube token error:", err.response?.data || err.message);
//         return res.status(400).json({
//           success: false,
//           msg:
//             "YouTube token exchange failed: " +
//             (err.response?.data?.error_description || err.message),
//           error: err.response?.data
//         });
//       }

//       accessToken  = tokenData.access_token;
//       refreshToken = tokenData.refresh_token || null;
//       expiresIn    = tokenData.expires_in;

//       if (!accessToken) {
//         return res.status(400).json({
//           success: false,
//           msg: "YouTube access token missing",
//           raw: tokenData
//         });
//       }

//       try {
//         const channelRes = await axios.get(
//           "https://www.googleapis.com/youtube/v3/channels",
//           {
//             headers: { Authorization: `Bearer ${accessToken}` },
//             params:  { part: "snippet", mine: true }
//           }
//         );
//         const channel = channelRes.data.items?.[0];
//         if (channel) {
//           accountId    = channel.id;
//           accountName  = channel.snippet?.title || "YouTube Channel";
//           profileImage = channel.snippet?.thumbnails?.default?.url || "";
//         } else {
//           throw new Error("No YouTube channel found");
//         }
//       } catch {
//         try {
//           const userRes = await axios.get(
//             "https://www.googleapis.com/oauth2/v2/userinfo",
//             { headers: { Authorization: `Bearer ${accessToken}` } }
//           );
//           accountId    = userRes.data.id;
//           accountName  = userRes.data.name || "YouTube User";
//           profileImage = userRes.data.picture || "";
//         } catch {
//           return res.status(400).json({
//             success: false,
//             msg: "Could not fetch YouTube user info"
//           });
//         }
//       }

//       // refresh_token sirf PEHLI baar milta hai (prompt=consent ke saath).
//       // Agar dobara connect kar rahe hain aur Google refresh_token nahi
//       // bhejta, purana refresh token DB se uthao taaki kho na jaaye.
//       if (!refreshToken) {
//         const existing = await SocialAccount.findOne({
//           user: req.user.id, platform: "youtube", accountId, client: targetClientId
//         }).select("+refreshToken");
//         if (existing?.refreshToken) {
//           const { decrypt } = require("../../utils/encrypt.util");
//           try { refreshToken = decrypt(existing.refreshToken); } catch { refreshToken = null; }
//         }
//       }
//     }

//     // =====================================================
//     // PINTEREST
//     // =====================================================
//     else if (platform === "pinterest") {
//       const tokenRes = await axios.post(
//         config.tokenUrl,
//         new URLSearchParams({
//           code,
//           grant_type:   "authorization_code",
//           redirect_uri: usedRedirectUri
//         }),
//         {
//           headers: {
//             "Content-Type": "application/x-www-form-urlencoded",
//             Authorization:
//               "Basic " +
//               Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")
//           }
//         }
//       );

//       accessToken  = tokenRes.data.access_token;
//       refreshToken = tokenRes.data.refresh_token;
//       expiresIn    = tokenRes.data.expires_in;

//       const userRes = await axios.get(
//         "https://api.pinterest.com/v5/user_account",
//         { headers: { Authorization: `Bearer ${accessToken}` } }
//       );

//       accountId    = userRes.data.username || userRes.data.id;
//       accountName  = userRes.data.display_name || userRes.data.username;
//       profileImage = userRes.data.profile_image || "";
//     }

//     // =====================================================
//     // THREADS
//     // v20: Do-step token exchange chahiye —
//     //   1) code -> short-lived token (graph.threads.net/oauth/access_token)
//     //   2) short-lived -> long-lived token (60 din valid, refresh
//     //      hota rehta hai) — warna token bahut jaldi (1 ghante me)
//     //      expire ho jaata, roz reconnect karwana padta.
//     // =====================================================
//     else if (platform === "threads") {
//       try {
//         const tokenRes = await axios.post(
//           config.tokenUrl,
//           new URLSearchParams({
//             client_id:     config.clientId,
//             client_secret: config.clientSecret,
//             grant_type:    "authorization_code",
//             redirect_uri:  usedRedirectUri,
//             code
//           }),
//           { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//         );

//         const shortLivedToken = tokenRes.data?.access_token;
//         const threadsUserId   = tokenRes.data?.user_id;

//         if (!shortLivedToken || !threadsUserId) {
//           return res.status(400).json({
//             success: false,
//             msg: "Threads token missing",
//             raw: tokenRes.data
//           });
//         }

//         // Short-lived (1hr) -> Long-lived (60 din) exchange
//         const longLivedRes = await axios.get("https://graph.threads.net/access_token", {
//           params: {
//             grant_type:    "th_exchange_token",
//             client_secret: config.clientSecret,
//             access_token:  shortLivedToken
//           }
//         });

//         accessToken = longLivedRes.data?.access_token || shortLivedToken;
//         expiresIn   = longLivedRes.data?.expires_in || 3600;
//         accountId   = threadsUserId;

//         // const profileRes = await axios.get(`https://graph.threads.net/v1.0/${threadsUserId}`, {
//         //   params: {
//         //     fields: "id,username,threads_profile_picture_url",
//         //     access_token: accessToken
//         //   }
//         // });

//         // accountName  = profileRes.data?.username || "Threads Account";
//         // profileImage = profileRes.data?.threads_profile_picture_url || "";

//         // FIXED v21.2: raw numeric threadsUserId se direct query karne pe
//         // "Unsupported get request... does not exist" (code 100, subcode 33)
//         // error aa raha tha — turant token milne ke baad "me" alias use
//         // karna zyada reliable hai (Meta ki apni recommended pattern).
//         const profileRes = await axios.get(`https://graph.threads.net/v1.0/me`, {
//           params: {
//             fields: "id,username,threads_profile_picture_url",
//             access_token: accessToken
//           }
//         });

//         accountName  = profileRes.data?.username || "Threads Account";
//         profileImage = profileRes.data?.threads_profile_picture_url || "";
//         // Extra safety — agar profile endpoint apna khud ka confirmed id
//         // de raha hai, usi ko trust karo (token-exchange wale se zyada reliable)
//         accountId    = profileRes.data?.id || accountId;

//       } catch (err) {
//         console.error("THREADS ERROR:", err.response?.data || err.message);
//         return res.status(400).json({
//           success: false,
//           msg: "Threads OAuth failed — confirm the connected account is an Instagram Business/Creator account linked to a Threads profile.",
//           error: err.response?.data
//         });
//       }
//     }

//     // =====================================================
//     // SAVE TO DB
//     // =====================================================
//     const ownerType = (req.user.role === "admin" || req.user.role === "Admin") ? "Agency" : "User2";

//     const query = {
//       user:     req.user.id,
//       platform,
//       accountId,
//       client:   targetClientId
//     };

//     const socialAccount = await SocialAccount.findOneAndUpdate(
//       query,
//       {
//         user:     req.user.id,
//         ownerType,
//         client:   targetClientId,
//         platform,
//         accountName,
//         accountId,
//         accessToken:  encrypt(accessToken),
//         refreshToken: refreshToken ? encrypt(refreshToken) : null,
//         profileImage,
//         isActive:     true,
//         connectedAt:  new Date(),
//         tokenExpiresAt: expiresIn
//           ? new Date(Date.now() + expiresIn * 1000)
//           : null
//       },
//       { upsert: true, returnDocument: "after", new: true }
//     );

//     const io = req.app.get("io");
//     await sendNotification({
//       io,
//       userId: req.user.id,
//       type: ownerType === "Agency" ? "Agency" : "User2",
//       event: "account_connected",
//       title: "Account Connected",
//       message: `${platform} account connected successfully${targetClientId ? " (for client)" : ""}`
//     });

//     return res.status(200).json({
//       success: true,
//       msg: targetClientId
//         ? `${platform} account connected for client`
//         : `${platform} account connected successfully`,
//       forClient: targetClientId || null,
//       data: socialAccount
//     });

//   } catch (err) {
//     console.error("connectAccount error:", err);
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };



// ==========================================
// FILE: src/controllers/social/connect.controller.js
// UPDATED v18:
//   - sendNotification() ab sahi object-signature se call hota hai
//     (pehle io ko positional arg ki tarah pass kiya jaata tha,
//     jisse notification kabhi DB me save hi nahi hoti thi)
//   - "account_connected" event ab Notification model ke enum me
//     valid hai (pehle silently fail hota tha)
//   - ownerType set hota hai (User2 ya Agency) — jo connect kar
//     raha hai, refPath se sahi populate hoga
//   - FACEBOOK: ab sirf personal profile id save nahi hota — Page
//     list (/me/accounts) fetch karke Page id + Page access token
//     save hota hai (Graph API sirf Pages par posting allow karta
//     hai, personal profile par nahi)
//   - INSTAGRAM: Page ke through linked Instagram Business Account
//     dhoondha jaata hai (instagram_business_account field) — pehle
//     yeh kabhi fetch hi nahi hota tha, sirf FB profile id save ho
//     raha tha jisse publish karna structurally namumkin tha
//   - Multiple pages hone par optional `pageId` body param se
//     specific page choose ki ja sakti hai, warna pehla page default
// ==========================================

const SocialAccount    = require("../../models/socialAccount.model");
const axios            = require("axios");
const crypto           = require("crypto");
const OAUTH_CONFIG     = require("../../config/oauth.config");
const { encrypt }      = require("../../utils/encrypt.util");
const sendNotification = require("../../utils/sendNotification.utils");
const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

// =====================================================
// GET AUTH URL
// v18: SMM role ke liye clientId MANDATORY hai — SMM apne liye
// account connect nahi karta, hamesha apni agency ke kisi client
// ki taraf se (client se credentials/permission lekar) karta hai.
// Agency (admin) khud ke liye bina clientId ke bhi connect kar
// sakti hai.
// =====================================================
exports.getAuthUrl = async (req, res) => {
  const { platform } = req.params;
  const { clientId, source } = req.query;

  const config = OAUTH_CONFIG[platform];
  if (!config) {
    return res.status(400).json({ success: false, msg: "Invalid platform" });
  }

  if (req.user.role === "SMM") {
    const check = await validateClientForSmm(req.user.id, clientId);
    if (!check.valid) {
      return res.status(400).json({ success: false, msg: check.reason });
    }
  }

  // v20: mobile app se aane wala request pehchan-ne ke liye marker.
  // App apna auth URL request karte waqt ?source=app bhejta hai — ye
  // state ke andar save ho jaata hai (tamper-safe nahi, sirf routing
  // hint hai) taaki /auth/callback pe pata chal sake user browser
  // (website) se aaya tha ya app (webview) se, aur us hisaab se
  // sahi jagah redirect kiya ja sake.
  const statePayload = {
    userId: req.user.id,
    platform,
    time: Date.now(),
    ...(clientId ? { clientId } : {}),
    ...(source === "app" ? { source: "app" } : {})
  };

  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  let url =
    `${config.authUrl}?` +
    `response_type=code` +
    `&client_id=${config.clientId}` +
    `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
    `&scope=${encodeURIComponent(config.scope)}` +
    `&state=${state}`;

  if (platform === "twitter") {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const twitterUrl =
      `${config.authUrl}?` +
      `response_type=code` +
      `&client_id=${config.clientId}` +
      `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
      `&scope=${encodeURIComponent(config.scope)}` +
      `&state=${state}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256`;

    return res.json({ success: true, url: twitterUrl, codeVerifier });
  }

  if (platform === "youtube" || platform === "google") {
    url += `&access_type=offline&prompt=consent`;
  }

  return res.json({ success: true, url });
};


// =====================================================
// CONNECT ACCOUNT
// =====================================================
exports.connectAccount = async (req, res) => {
  try {
    const {
      platform,
      code,
      state,
      codeVerifier,
      redirectUri: clientRedirectUri,
      pageId         // optional — Facebook/Instagram me multiple pages hone par
    } = req.body;

    if (!platform || !code || !state) {
      return res.status(400).json({
        success: false,
        msg: "platform, code, state required"
      });
    }

    if (platform === "twitter" && !codeVerifier) {
      return res.status(400).json({
        success: false,
        msg: "codeVerifier required for Twitter"
      });
    }

    // ─── Decode & verify state ────────────────────────────────────
    let decoded;
    try {
      const normalized = state.replace(/-/g, "+").replace(/_/g, "/");
      decoded = JSON.parse(Buffer.from(normalized, "base64").toString());
    } catch {
      return res.status(400).json({ success: false, msg: "Invalid state" });
    }

    if (decoded.userId !== req.user.id) {
      return res.status(401).json({ success: false, msg: "State mismatch" });
    }

    const targetClientId = decoded.clientId || null;

    // ── v18: state base64-encoded hai, cryptographically signed nahi —
    // isliye clientId yahan SERVER-SIDE dobara validate karna zaroori
    // hai (warna koi SMM state tamper karke doosri agency ke client
    // ke naam pe account connect kar sakta tha)
    if (req.user.role === "SMM") {
      const check = await validateClientForSmm(req.user.id, targetClientId);
      if (!check.valid) {
        return res.status(400).json({ success: false, msg: check.reason });
      }
    }

    const config = OAUTH_CONFIG[platform];
    if (!config) {
      return res.status(400).json({ success: false, msg: "Invalid platform" });
    }

    // FIXED v21.3: Pehle frontend jo bhi `redirectUri` bhejta tha, wahi
    // trust kar liya jaata tha token-exchange ke liye. Isse Facebook
    // "Can't load URL: domain not included" error deta tha jab frontend
    // apna khud ka domain (jaise Vercel URL) bhej deta — kyunki Facebook
    // Developer Console me sirf backend ka `/auth/callback` URL
    // registered hai, frontend ka nahi. Ab hamesha backend ka apna
    // registered URL (.env se) use hota hai — client-sent value ignore
    // kar diya jaata hai (zyada secure bhi hai — ye value server-to-
    // server OAuth call me jaati hai, client input pe depend nahi karni
    // chahiye).
    const usedRedirectUri = config.redirectUri;

    let accessToken, refreshToken = null, expiresIn;
    let accountId, accountName, profileImage = "";

    // =====================================================
    // FACEBOOK
    // v21: PEHLE sirf EK Page save hoti thi (pageId diya ho to wahi,
    //   warna pages[0] — user ko pata hi nahi chalta tha post kis Page
    //   pe gaya). AB — user jitne bhi Facebook Pages manage karta hai,
    //   SAB ko alag-alag SocialAccount documents ke roop me save kiya
    //   jaata hai (isi client ke naam). Post banate waqt frontend
    //   `GET /api/social/accounts?clientId=X&platform=facebook` call
    //   karke saari connected Pages ki list dikha sakta hai — user
    //   wahan se specific Page select karega, uski accountId
    //   post.platformAccounts array me bhejegi.
    // =====================================================
    if (platform === "facebook") {
      try {
        const tokenRes = await axios.get(config.tokenUrl, {
          params: {
            client_id:     config.clientId,
            client_secret: config.clientSecret,
            redirect_uri:  usedRedirectUri,
            code
          }
        });

        const userAccessToken = tokenRes.data?.access_token;
        if (!userAccessToken) {
          return res.status(400).json({
            success: false,
            msg: "Facebook token missing",
            raw: tokenRes.data
          });
        }

        // Graph API sirf Pages par publish allow karta hai — personal
        // profile par direct posting bohot saal pehle band kar di gayi thi.
        const pagesRes = await axios.get("https://graph.facebook.com/v18.0/me/accounts", {
          params: { access_token: userAccessToken, fields: "id,name,access_token,picture" }
        });

        let pages = pagesRes.data?.data || [];
        if (!pages.length) {
          return res.status(400).json({
            success: false,
            msg: "No Facebook Page found for this account. Publishing requires a connected Facebook Page (personal profiles can't be posted to via API)."
          });
        }

        // Agar frontend ne specifically ek pageId bheja hai (jaise
        // "sirf isi Page ko reconnect/refresh karo"), to sirf wahi
        // process karo. Warna default: SAARI Pages save karo.
        if (pageId) {
          pages = pages.filter(p => p.id === pageId);
        }

        const ownerType = (req.user.role === "admin" || req.user.role === "Admin") ? "Agency" : "User2";
        const savedAccounts = [];

        for (const page of pages) {
          const pageExpiresIn = tokenRes.data?.expires_in || null;

          const saved = await SocialAccount.findOneAndUpdate(
            { user: req.user.id, platform: "facebook", accountId: page.id, client: targetClientId },
            {
              user:     req.user.id,
              ownerType,
              client:   targetClientId,
              platform: "facebook",
              accountName:  page.name,
              accountId:    page.id,
              accessToken:  encrypt(page.access_token), // Page access token — isi se posting hoti hai
              refreshToken: null,
              profileImage: page.picture?.data?.url || "",
              isActive:     true,
              connectedAt:  new Date(),
              tokenExpiresAt: pageExpiresIn ? new Date(Date.now() + pageExpiresIn * 1000) : null
            },
            { upsert: true, returnDocument: "after", new: true }
          );

          savedAccounts.push(saved);
        }

        const io = req.app.get("io");
        await sendNotification({
          io,
          userId: req.user.id,
          type: ownerType === "Agency" ? "Agency" : "User2",
          event: "account_connected",
          title: "Account Connected",
          message: `Facebook — ${savedAccounts.length} Page${savedAccounts.length > 1 ? "s" : ""} connected successfully${targetClientId ? " (for client)" : ""}`
        });

        // Facebook ke liye yahin response bhej do — neeche wala generic
        // single-account "SAVE TO DB" block skip ho jaayega.
        return res.status(200).json({
          success: true,
          msg: `${savedAccounts.length} Facebook Page${savedAccounts.length > 1 ? "s" : ""} connected successfully`,
          forClient: targetClientId || null,
          data: savedAccounts
        });

      } catch (err) {
        console.error("FACEBOOK ERROR:", err.response?.data || err.message);
        return res.status(400).json({
          success: false,
          msg: "Facebook OAuth failed",
          error: err.response?.data
        });
      }
    }

    // =====================================================
    // INSTAGRAM (Business account linked to a Facebook Page)
    // =====================================================
    else if (platform === "instagram") {
      try {
        const tokenRes = await axios.get(config.tokenUrl, {
          params: {
            client_id:     config.clientId,
            client_secret: config.clientSecret,
            redirect_uri:  usedRedirectUri,
            code
          }
        });

        const userAccessToken = tokenRes.data?.access_token;
        if (!userAccessToken) {
          return res.status(400).json({
            success: false,
            msg: "Facebook token missing",
            raw: tokenRes.data
          });
        }

        const pagesRes = await axios.get("https://graph.facebook.com/v18.0/me/accounts", {
          params: { access_token: userAccessToken, fields: "id,name,access_token" }
        });

        const pages = pagesRes.data?.data || [];
        if (!pages.length) {
          return res.status(400).json({
            success: false,
            msg: "No Facebook Page found. Instagram publishing requires an Instagram Business/Creator account linked to a Facebook Page."
          });
        }

        // Har page ke liye check karo ki uske saath Instagram Business Account linked hai ya nahi
        let igAccount = null;
        let igPageAccessToken = null;

        for (const page of pages) {
          if (pageId && page.id !== pageId) continue;

          const igRes = await axios.get(`https://graph.facebook.com/v18.0/${page.id}`, {
            params: {
              fields: "instagram_business_account{id,username,profile_picture_url}",
              access_token: page.access_token
            }
          });

          if (igRes.data?.instagram_business_account) {
            igAccount = igRes.data.instagram_business_account;
            igPageAccessToken = page.access_token;
            break;
          }
        }

        if (!igAccount) {
          return res.status(400).json({
            success: false,
            msg: "No Instagram Business/Creator account linked to your Facebook Page(s) was found."
          });
        }

        accessToken  = igPageAccessToken; // IG Graph API posting bhi Page access token se hota hai
        expiresIn    = tokenRes.data?.expires_in || null;
        accountId    = igAccount.id;
        accountName  = igAccount.username || "Instagram Account";
        profileImage = igAccount.profile_picture_url || "";

      } catch (err) {
        console.error("INSTAGRAM ERROR:", err.response?.data || err.message);
        return res.status(400).json({
          success: false,
          msg: "Instagram OAuth failed",
          error: err.response?.data
        });
      }
    }

    // =====================================================
    // TWITTER
    // =====================================================
    else if (platform === "twitter") {
      const tokenRes = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          code,
          grant_type:    "authorization_code",
          client_id:     config.clientId,
          redirect_uri:  usedRedirectUri,
          code_verifier: codeVerifier
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          auth:    { username: config.clientId, password: config.clientSecret }
        }
      );

      accessToken  = tokenRes.data.access_token;
      refreshToken = tokenRes.data.refresh_token;
      expiresIn    = tokenRes.data.expires_in;

      const userRes = await axios.get("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      accountId   = userRes.data.data.id;
      accountName = userRes.data.data.name;
    }

    // =====================================================
    // LINKEDIN
    // =====================================================
    else if (platform === "linkedin") {
      const tokenRes = await axios.post(config.tokenUrl, null, {
        params: {
          grant_type:    "authorization_code",
          code,
          redirect_uri:  usedRedirectUri,
          client_id:     config.clientId,
          client_secret: config.clientSecret
        }
      });

      accessToken  = tokenRes.data.access_token;
      refreshToken = tokenRes.data.refresh_token;
      expiresIn    = tokenRes.data.expires_in;

      const userRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      accountId    = userRes.data.sub;
      accountName  = userRes.data.name;
      profileImage = userRes.data.picture || "";
    }

    // =====================================================
    // YOUTUBE — with refresh token (offline access)
    // =====================================================
    else if (platform === "youtube") {
      let tokenData;
      try {
        const tokenRes = await axios.post(
          config.tokenUrl,
          new URLSearchParams({
            code,
            client_id:     config.clientId,
            client_secret: config.clientSecret,
            redirect_uri:  usedRedirectUri,
            grant_type:    "authorization_code"
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        tokenData = tokenRes.data;
      } catch (err) {
        console.error("YouTube token error:", err.response?.data || err.message);
        return res.status(400).json({
          success: false,
          msg:
            "YouTube token exchange failed: " +
            (err.response?.data?.error_description || err.message),
          error: err.response?.data
        });
      }

      accessToken  = tokenData.access_token;
      refreshToken = tokenData.refresh_token || null;
      expiresIn    = tokenData.expires_in;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          msg: "YouTube access token missing",
          raw: tokenData
        });
      }

      try {
        const channelRes = await axios.get(
          "https://www.googleapis.com/youtube/v3/channels",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params:  { part: "snippet", mine: true }
          }
        );
        const channel = channelRes.data.items?.[0];
        if (channel) {
          accountId    = channel.id;
          accountName  = channel.snippet?.title || "YouTube Channel";
          profileImage = channel.snippet?.thumbnails?.default?.url || "";
        } else {
          throw new Error("No YouTube channel found");
        }
      } catch {
        try {
          const userRes = await axios.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          accountId    = userRes.data.id;
          accountName  = userRes.data.name || "YouTube User";
          profileImage = userRes.data.picture || "";
        } catch {
          return res.status(400).json({
            success: false,
            msg: "Could not fetch YouTube user info"
          });
        }
      }

      // refresh_token sirf PEHLI baar milta hai (prompt=consent ke saath).
      // Agar dobara connect kar rahe hain aur Google refresh_token nahi
      // bhejta, purana refresh token DB se uthao taaki kho na jaaye.
      if (!refreshToken) {
        const existing = await SocialAccount.findOne({
          user: req.user.id, platform: "youtube", accountId, client: targetClientId
        }).select("+refreshToken");
        if (existing?.refreshToken) {
          const { decrypt } = require("../../utils/encrypt.util");
          try { refreshToken = decrypt(existing.refreshToken); } catch { refreshToken = null; }
        }
      }
    }

    // =====================================================
    // PINTEREST
    // =====================================================
    else if (platform === "pinterest") {
      const tokenRes = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          code,
          grant_type:   "authorization_code",
          redirect_uri: usedRedirectUri
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")
          }
        }
      );

      accessToken  = tokenRes.data.access_token;
      refreshToken = tokenRes.data.refresh_token;
      expiresIn    = tokenRes.data.expires_in;

      const userRes = await axios.get(
        "https://api.pinterest.com/v5/user_account",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      accountId    = userRes.data.username || userRes.data.id;
      accountName  = userRes.data.display_name || userRes.data.username;
      profileImage = userRes.data.profile_image || "";
    }

    // =====================================================
    // THREADS
    // v20: Do-step token exchange chahiye —
    //   1) code -> short-lived token (graph.threads.net/oauth/access_token)
    //   2) short-lived -> long-lived token (60 din valid, refresh
    //      hota rehta hai) — warna token bahut jaldi (1 ghante me)
    //      expire ho jaata, roz reconnect karwana padta.
    // =====================================================
    else if (platform === "threads") {
      try {
        const tokenRes = await axios.post(
          config.tokenUrl,
          new URLSearchParams({
            client_id:     config.clientId,
            client_secret: config.clientSecret,
            grant_type:    "authorization_code",
            redirect_uri:  usedRedirectUri,
            code
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const shortLivedToken = tokenRes.data?.access_token;
        const threadsUserId   = tokenRes.data?.user_id;

        if (!shortLivedToken || !threadsUserId) {
          return res.status(400).json({
            success: false,
            msg: "Threads token missing",
            raw: tokenRes.data
          });
        }

        // Short-lived (1hr) -> Long-lived (60 din) exchange
        const longLivedRes = await axios.get("https://graph.threads.net/access_token", {
          params: {
            grant_type:    "th_exchange_token",
            client_secret: config.clientSecret,
            access_token:  shortLivedToken
          }
        });

        accessToken = longLivedRes.data?.access_token || shortLivedToken;
        expiresIn   = longLivedRes.data?.expires_in || 3600;
        accountId   = threadsUserId;

        // const profileRes = await axios.get(`https://graph.threads.net/v1.0/${threadsUserId}`, {
        //   params: {
        //     fields: "id,username,threads_profile_picture_url",
        //     access_token: accessToken
        //   }
        // });

        // accountName  = profileRes.data?.username || "Threads Account";
        // profileImage = profileRes.data?.threads_profile_picture_url || "";

        // FIXED v21.2: raw numeric threadsUserId se direct query karne pe
        // "Unsupported get request... does not exist" (code 100, subcode 33)
        // error aa raha tha — turant token milne ke baad "me" alias use
        // karna zyada reliable hai (Meta ki apni recommended pattern).
        const profileRes = await axios.get(`https://graph.threads.net/v1.0/me`, {
          params: {
            fields: "id,username,threads_profile_picture_url",
            access_token: accessToken
          }
        });

        accountName  = profileRes.data?.username || "Threads Account";
        profileImage = profileRes.data?.threads_profile_picture_url || "";
        // Extra safety — agar profile endpoint apna khud ka confirmed id
        // de raha hai, usi ko trust karo (token-exchange wale se zyada reliable)
        accountId    = profileRes.data?.id || accountId;

      } catch (err) {
        console.error("THREADS ERROR:", err.response?.data || err.message);
        return res.status(400).json({
          success: false,
          msg: "Threads OAuth failed — confirm the connected account is an Instagram Business/Creator account linked to a Threads profile.",
          error: err.response?.data
        });
      }
    }

    // =====================================================
    // SAVE TO DB
    // =====================================================
    const ownerType = (req.user.role === "admin" || req.user.role === "Admin") ? "Agency" : "User2";

    const query = {
      user:     req.user.id,
      platform,
      accountId,
      client:   targetClientId
    };

    const socialAccount = await SocialAccount.findOneAndUpdate(
      query,
      {
        user:     req.user.id,
        ownerType,
        client:   targetClientId,
        platform,
        accountName,
        accountId,
        accessToken:  encrypt(accessToken),
        refreshToken: refreshToken ? encrypt(refreshToken) : null,
        profileImage,
        isActive:     true,
        connectedAt:  new Date(),
        tokenExpiresAt: expiresIn
          ? new Date(Date.now() + expiresIn * 1000)
          : null
      },
      { upsert: true, returnDocument: "after", new: true }
    );

    const io = req.app.get("io");
    await sendNotification({
      io,
      userId: req.user.id,
      type: ownerType === "Agency" ? "Agency" : "User2",
      event: "account_connected",
      title: "Account Connected",
      message: `${platform} account connected successfully${targetClientId ? " (for client)" : ""}`
    });

    return res.status(200).json({
      success: true,
      msg: targetClientId
        ? `${platform} account connected for client`
        : `${platform} account connected successfully`,
      forClient: targetClientId || null,
      data: socialAccount
    });

  } catch (err) {
    console.error("connectAccount error:", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};

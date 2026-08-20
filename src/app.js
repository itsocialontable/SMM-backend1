// // ==========================================
// // FILE: src/app.js
// // UPDATED v16: Agency Branding + Subscription routes added
// // ==========================================

// const express = require("express");
// const cors    = require("cors");

// const app = express();

// // ================= CORS =================
// // FIXED v19.1: Pehle allowedOrigins hardcoded thi (sirf 3 localhost ports +
// // 1 fixed ngrok URL) — .env ka FRONTEND_URL/ALLOWED_ORIGINS kabhi use hi
// // nahi hota tha. Isliye jab bhi koi doosre PC/device/domain se (ya ngrok
// // URL restart hone par naya URL mil jaane se) frontend access karta tha,
// // origin whitelist me na hone ki wajah se CORS silently saari requests
// // block kar deta tha — login ho jaata tha (token bann jaata) lekin baaki
// // saari GET/POST calls fail ho jaati thi, isliye data blank dikhta tha.
// //
// // Ab origins .env se aate hain (comma-separated ALLOWED_ORIGINS, plus
// // FRONTEND_URL), aur kuch common local-dev ports fallback ke liye rakhe
// // hain. Production me ALLOWED_ORIGINS me apne asli domain(s) daal do.

// const envOrigins = (process.env.ALLOWED_ORIGINS || "")
//   .split(",")
//   .map(o => o.trim())
//   .filter(Boolean);

// const allowedOrigins = [
//   ...envOrigins,
//   process.env.FRONTEND_URL,
//   // local-dev fallbacks — production me inhe hata sakte ho
//   "http://localhost:8080",
//   // "https://ornate-cocada-431ffc.netlify.app",
//   // "https://smm-web-frontend-9k9o4qw89-socialontable.vercel.app",
//   "https://smm-web-frontend.vercel.app",
//   "http://localhost:3000",
//   "http://localhost:4000",
//   "http://localhost:5173"
// ].filter(Boolean);

// app.use(cors({
//   origin: (origin, callback) => {
//     // no origin => server-to-server / curl / mobile app / Postman — allow
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }

//     console.warn(`⚠️  CORS blocked request from origin: ${origin}. ` +
//       `Add it to ALLOWED_ORIGINS in .env if this is a legitimate frontend.`);
//     return callback(new Error(`CORS blocked: ${origin}`));
//   },
//   credentials: true
// }));

// // ================= BODY PARSERS =================
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// // ================= NO CACHE FOR API =================
// // FIXED: GET requests (clients/SMM/GD list, dashboard, etc.) ko browser
// // ya beech ka koi proxy (jaise ngrok) kabhi-kabhi cache kar leta tha,
// // jiski wajah se doosre device/browser pe kabhi purani/khaali list
// // dikhti thi, aur delete kiya hua data bhi kabhi cached response se
// // wapas dikh jaata tha. Ab har /api response explicitly "no-store" hai.
// app.use("/api", (req, res, next) => {
//   res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
//   res.set("Pragma", "no-cache");
//   next();
// });

// // ================= HEALTH CHECK =================
// app.get("/", (req, res) => {
//   res.json({ success: true, msg: "SMM Backend API v18 is running 🚀" });
// });

// // ================= PRIVACY POLICY =================
// app.get("/privacy-policy", (req, res) => {
//   res.send(`<html><head><title>Privacy Policy - GrowthCraft SMM</title></head>
//     <body style="font-family:Arial;max-width:900px;margin:40px auto;">
//       <h1>Privacy Policy</h1><p>GrowthCraft SMM respects your privacy.</p>
//       <h2>Information We Collect</h2>
//       <p>We may collect account information and social media account data required to provide social media management services.</p>
//       <h2>How We Use Information</h2>
//       <p>Information is used for scheduling, publishing, analytics, reporting, and account management.</p>
//       <h2>Contact</h2><p>Email: it.growthcraft360@gmail.com</p>
//     </body></html>`);
// });

// // ================= TERMS =================
// app.get("/terms", (req, res) => {
//   res.send(`<html><head><title>Terms of Service</title></head>
//     <body style="font-family:Arial;max-width:900px;margin:40px auto;">
//       <h1>Terms of Service</h1><p>By using GrowthCraft SMM, you agree to our terms and policies.</p>
//     </body></html>`);
// });

// // ================= AUTH ROUTES =================
// app.use("/api/auth",    require("./routes/auth.routes"));

// // ================= USER ROUTES =================
// app.use("/api/user",    require("./routes/user.routes"));
// app.use("/api/user",    require("./routes/userAuth.routes"));

// // ================= SOCIAL ROUTES =================
// app.use("/api/social",  require("./routes/social.routes"));

// // ================= NOTIFICATION ROUTES =================
// app.use("/api/notifications", require("./routes/notifications.routes"));

// // ================= POST ROUTES =================
// app.use("/api/posts",   require("./routes/post.routes"));

// // ================= SUPER ADMIN ROUTES =================
// app.use("/api/superadmin", require("./routes/superAdmin.routes"));

// // ================= AGENCY ROUTES =================
// app.use("/api/agency",  require("./routes/agencyAuth.routes"));

// // ================= AGENCY BRANDING (NEW v16) =================
// app.use("/api/agency/branding", require("./routes/agencyBranding.routes"));

// // ================= ADMIN ROUTES =================
// app.use("/api/admin",   require("./routes/adminAuth.routes"));

// // ================= ADMIN USER MANAGEMENT =================
// app.use("/api/admin/users", require("./routes/adminUserManagement.routes"));

// // ================= ADMIN DESIGN PROJECTS =================
// app.use("/api/admin/design-projects", require("./routes/adminDesignProject.routes"));

// // ================= ADMIN INVOICES (NEW ADD-ON) =================
// // Admin client add karte waqt (ya baad me) invoice generate kar sakta hai
// app.use("/api/admin/invoices", require("./routes/adminInvoice.routes"));

// // ================= ADMIN ANALYTICS (NEW ADD-ON) =================
// // Agency-wide analytics overview (weekly/monthly/yearly trend) + real revenue overview
// app.use("/api/admin/analytics", require("./routes/adminAnalytics.routes"));

// // ================= GRAPHIC DESIGNER =================
// app.use("/api/gd",      require("./routes/graphicDesigner.routes"));

// // ================= CLIENT =================
// app.use("/api/client",  require("./routes/client.routes"));

// // ================= SMM =================
// app.use("/api/smm",     require("./routes/smm.routes"));

// // ================= OAUTH CALLBACK =================
// app.get("/auth/callback", (req, res) => {
//   const { code, state, error, error_description } = req.query;
//   const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080" || "";

//   // v20: Website aur mobile app dono isi single /auth/callback URL ko
//   // Facebook/Google me redirect_uri ki tarah use karte hain (kyunki
//   // dono ke provider console me alag-alag redirect URI register karna
//   // extra overhead + har platform pe dobara verification hota).
//   // Farak sirf itna hai ki app se aaya request ka `state` decode karne
//   // par { source: "app" } milega (getAuthUrl me set kiya gaya) —
//   // usi marker se yahan decide karte hain kahan bhejna hai.
//   // Website flow (marker na ho) — bilkul pehle jaisa hi, kuch change nahi.
//   let source = null;
//   if (state) {
//     try {
//       const normalized = state.replace(/-/g, "+").replace(/_/g, "/");
//       const decoded = JSON.parse(Buffer.from(normalized, "base64").toString());
//       source = decoded?.source || null;
//     } catch {
//       // state corrupt/invalid ho to bhi normal website flow me hi bhej do —
//       // connectAccount() waha pe already state validate karega aur
//       // proper "Invalid state" error dega.
//     }
//   }

//   const queryString = `code=${code || ""}&state=${state || ""}` +
//     (error ? `&error=${error}&error_description=${error_description || ""}` : "");

//   if (source === "app") {
//     const appScheme = process.env.APP_OAUTH_REDIRECT || "smmapp://oauth-callback";
//     return res.redirect(`${appScheme}?${queryString}`);
//   }

//   return res.redirect(`${frontendUrl}/auth/callback?${queryString}`);
// });

// // ================= MULTER ERROR HANDLER =================
// app.use((err, req, res, next) => {
//   if (err.name === "MulterError") {
//     if (err.code === "LIMIT_FILE_SIZE")  return res.status(400).json({ success: false, msg: "File too large. Max 100MB allowed." });
//     if (err.code === "LIMIT_FILE_COUNT") return res.status(400).json({ success: false, msg: "Too many files. Max 10 files allowed." });
//     return res.status(400).json({ success: false, msg: err.message });
//   }
//   if (err.message?.includes("File type not allowed")) {
//     return res.status(400).json({ success: false, msg: err.message });
//   }
//   next(err);
// });

// // ================= GLOBAL ERROR HANDLER =================
// app.use((err, req, res, next) => {
//   console.error("UNHANDLED ERROR =>", err);
//   res.status(500).json({ success: false, msg: err.message || "Internal Server Error" });
// });

// module.exports = app;

// ==========================================
// FILE: src/app.js
// UPDATED v16: Agency Branding + Subscription routes added
// ==========================================

const express = require("express");
const cors    = require("cors");

const app = express();

// ================= CORS =================
// FIXED v19.1: Pehle allowedOrigins hardcoded thi (sirf 3 localhost ports +
// 1 fixed ngrok URL) — .env ka FRONTEND_URL/ALLOWED_ORIGINS kabhi use hi
// nahi hota tha. Isliye jab bhi koi doosre PC/device/domain se (ya ngrok
// URL restart hone par naya URL mil jaane se) frontend access karta tha,
// origin whitelist me na hone ki wajah se CORS silently saari requests
// block kar deta tha — login ho jaata tha (token bann jaata) lekin baaki
// saari GET/POST calls fail ho jaati thi, isliye data blank dikhta tha.
//
// Ab origins .env se aate hain (comma-separated ALLOWED_ORIGINS, plus
// FRONTEND_URL), aur kuch common local-dev ports fallback ke liye rakhe
// hain. Production me ALLOWED_ORIGINS me apne asli domain(s) daal do.

const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...envOrigins,
  process.env.FRONTEND_URL,
  // local-dev fallbacks — production me inhe hata sakte ho
  "http://localhost:8080",
  // "https://ornate-cocada-431ffc.netlify.app",
  // "https://smm-web-frontend-9k9o4qw89-socialontable.vercel.app",
  "https://smm-web-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5173"
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // no origin => server-to-server / curl / mobile app / Postman — allow
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`⚠️  CORS blocked request from origin: ${origin}. ` +
      `Add it to ALLOWED_ORIGINS in .env if this is a legitimate frontend.`);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

// ================= BODY PARSERS =================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ================= NO CACHE FOR API =================
// FIXED: GET requests (clients/SMM/GD list, dashboard, etc.) ko browser
// ya beech ka koi proxy (jaise ngrok) kabhi-kabhi cache kar leta tha,
// jiski wajah se doosre device/browser pe kabhi purani/khaali list
// dikhti thi, aur delete kiya hua data bhi kabhi cached response se
// wapas dikh jaata tha. Ab har /api response explicitly "no-store" hai.
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  next();
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.json({ success: true, msg: "SMM Backend API v18 is running 🚀" });
});

// ================= PRIVACY POLICY =================
app.get("/privacy-policy", (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Privacy Policy - SocialFlow Pro (Social On Table)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}
  h1{color:#111}
  h2{color:#1a1a2e;margin-top:32px}
  .updated{color:#666;font-size:14px}
</style></head>
<body>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated: August 2026</p>

  <p>SocialFlow Pro (operated by Social On Table, "we", "us", "our") is a social media
  management platform that allows social media agencies and their team members to
  connect, schedule, and publish content to their clients' social media accounts
  (including Facebook, Instagram, Threads, and YouTube) on the clients' behalf.</p>

  <h2>1. Information We Collect</h2>
  <p>When you connect a social media account (Facebook, Instagram, Threads, YouTube) to
  our platform, we collect and store:</p>
  <ul>
    <li>Basic profile information (account name, username, profile picture)</li>
    <li>Access tokens issued by the platform, used to publish content on your behalf</li>
    <li>Content you create and publish through our platform (text, images, videos)</li>
    <li>Engagement and performance data (likes, comments, shares, reach, impressions,
        profile views) for posts published through our platform</li>
    <li>Account information you provide when signing up (name, email, phone number)</li>
  </ul>

  <h2>2. How We Use This Information</h2>
  <p>We use the information above strictly to provide our service, including:</p>
  <ul>
    <li>Publishing and scheduling posts, reels, and carousels on your connected accounts</li>
    <li>Displaying performance analytics (likes, comments, reach, engagement) back to
        you and your team inside the platform</li>
    <li>Managing your agency's clients, team members, and their connected accounts</li>
    <li>Sending account-related notifications (e.g. project updates, post status)</li>
  </ul>
  <p>We do not sell your data or your clients' social media data to third parties, and
  we do not use it for advertising purposes.</p>

  <h2>3. Data Retention &amp; Deletion</h2>
  <p>We retain connected-account data and access tokens only for as long as the account
  remains connected to our platform. You (or your agency admin) can disconnect any
  social media account at any time from within the platform, which immediately revokes
  our access and deletes the stored access token. You may also request full deletion of
  your account and associated data at any time by contacting us at the email below.</p>

  <h2>4. Data Sharing</h2>
  <p>We do not share your data with third parties except: (a) the social media platforms
  themselves (Meta, YouTube) as required to publish content and retrieve analytics on
  your behalf, and (b) service providers who help us operate our infrastructure (e.g.
  cloud hosting, email delivery), under confidentiality obligations.</p>

  <h2>5. Data Security</h2>
  <p>We implement reasonable administrative, technical, and physical safeguards
  (including encrypted storage of access tokens) to protect your information from
  unauthorised access, alteration, disclosure, or destruction.</p>

  <h2>6. Your Rights</h2>
  <p>You may access, correct, or request deletion of your personal data and connected
  account data at any time by contacting us using the details below.</p>

  <h2>7. Children's Privacy</h2>
  <p>Our platform is not directed at individuals under the age of 18. We do not
  knowingly collect personal information from children.</p>

  <h2>8. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. The updated version will be
  posted on this page with a revised "Last updated" date.</p>

  <h2>9. Contact Us</h2>
  <p>If you have any questions about this Privacy Policy or how we handle your data,
  please contact us:</p>
  <p>Email: <a href="mailto:info@socialontable.com">info@socialontable.com</a><br>
  Phone: +91 8619830626</p>
</body></html>`);
});

// ================= TERMS =================
app.get("/terms", (req, res) => {
  res.send(`<html><head><title>Terms of Service</title></head>
    <body style="font-family:Arial;max-width:900px;margin:40px auto;">
      <h1>Terms of Service</h1><p>By using GrowthCraft SMM, you agree to our terms and policies.</p>
    </body></html>`);
});

// ================= AUTH ROUTES =================
app.use("/api/auth",    require("./routes/auth.routes"));

// ================= USER ROUTES =================
app.use("/api/user",    require("./routes/user.routes"));
app.use("/api/user",    require("./routes/userAuth.routes"));

// ================= SOCIAL ROUTES =================
app.use("/api/social",  require("./routes/social.routes"));

// ================= NOTIFICATION ROUTES =================
app.use("/api/notifications", require("./routes/notifications.routes"));

// ================= POST ROUTES =================
app.use("/api/posts",   require("./routes/post.routes"));

// ================= SUPER ADMIN ROUTES =================
app.use("/api/superadmin", require("./routes/superAdmin.routes"));

// ================= AGENCY ROUTES =================
app.use("/api/agency",  require("./routes/agencyAuth.routes"));

// ================= AGENCY BRANDING (NEW v16) =================
app.use("/api/agency/branding", require("./routes/agencyBranding.routes"));

// ================= ADMIN ROUTES =================
app.use("/api/admin",   require("./routes/adminAuth.routes"));

// ================= ADMIN USER MANAGEMENT =================
app.use("/api/admin/users", require("./routes/adminUserManagement.routes"));

// ================= ADMIN DESIGN PROJECTS =================
app.use("/api/admin/design-projects", require("./routes/adminDesignProject.routes"));

// ================= ADMIN INVOICES (NEW ADD-ON) =================
// Admin client add karte waqt (ya baad me) invoice generate kar sakta hai
app.use("/api/admin/invoices", require("./routes/adminInvoice.routes"));

// ================= ADMIN ANALYTICS (NEW ADD-ON) =================
// Agency-wide analytics overview (weekly/monthly/yearly trend) + real revenue overview
app.use("/api/admin/analytics", require("./routes/adminAnalytics.routes"));

// ================= GRAPHIC DESIGNER =================
app.use("/api/gd",      require("./routes/graphicDesigner.routes"));

// ================= CLIENT =================
app.use("/api/client",  require("./routes/client.routes"));

// ================= SMM =================
app.use("/api/smm",     require("./routes/smm.routes"));

// ================= HELP & SUPPORT (NEW) =================
app.use("/api/support", require("./routes/support.routes"));

// ================= OAUTH CALLBACK =================
app.get("/auth/callback", (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080" || "";

  // v20: Website aur mobile app dono isi single /auth/callback URL ko
  // Facebook/Google me redirect_uri ki tarah use karte hain (kyunki
  // dono ke provider console me alag-alag redirect URI register karna
  // extra overhead + har platform pe dobara verification hota).
  // Farak sirf itna hai ki app se aaya request ka `state` decode karne
  // par { source: "app" } milega (getAuthUrl me set kiya gaya) —
  // usi marker se yahan decide karte hain kahan bhejna hai.
  // Website flow (marker na ho) — bilkul pehle jaisa hi, kuch change nahi.
  let source = null;
  if (state) {
    try {
      const normalized = state.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(Buffer.from(normalized, "base64").toString());
      source = decoded?.source || null;
    } catch {
      // state corrupt/invalid ho to bhi normal website flow me hi bhej do —
      // connectAccount() waha pe already state validate karega aur
      // proper "Invalid state" error dega.
    }
  }

  const queryString = `code=${code || ""}&state=${state || ""}` +
    (error ? `&error=${error}&error_description=${error_description || ""}` : "");

  if (source === "app") {
    const appScheme = process.env.APP_OAUTH_REDIRECT || "smmapp://oauth-callback";
    return res.redirect(`${appScheme}?${queryString}`);
  }

  return res.redirect(`${frontendUrl}/auth/callback?${queryString}`);
});

// ================= MULTER ERROR HANDLER =================
app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE")  return res.status(400).json({ success: false, msg: "File too large. Max 100MB allowed." });
    if (err.code === "LIMIT_FILE_COUNT") return res.status(400).json({ success: false, msg: "Too many files. Max 10 files allowed." });
    return res.status(400).json({ success: false, msg: err.message });
  }
  if (err.message?.includes("File type not allowed")) {
    return res.status(400).json({ success: false, msg: err.message });
  }
  next(err);
});

// ================= GLOBAL ERROR HANDLER ==================
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR =>", err);
  res.status(500).json({ success: false, msg: err.message || "Internal Server Error" });
});

module.exports = app;

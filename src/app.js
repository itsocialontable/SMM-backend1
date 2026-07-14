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
  res.send(`<html><head><title>Privacy Policy - GrowthCraft SMM</title></head>
    <body style="font-family:Arial;max-width:900px;margin:40px auto;">
      <h1>Privacy Policy</h1><p>GrowthCraft SMM respects your privacy.</p>
      <h2>Information We Collect</h2>
      <p>We may collect account information and social media account data required to provide social media management services.</p>
      <h2>How We Use Information</h2>
      <p>Information is used for scheduling, publishing, analytics, reporting, and account management.</p>
      <h2>Contact</h2><p>Email: it.growthcraft360@gmail.com</p>
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

// ================= GRAPHIC DESIGNER =================
app.use("/api/gd",      require("./routes/graphicDesigner.routes"));

// ================= CLIENT =================
app.use("/api/client",  require("./routes/client.routes"));

// ================= SMM =================
app.use("/api/smm",     require("./routes/smm.routes"));

// ================= OAUTH CALLBACK =================
app.get("/auth/callback", (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";

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

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR =>", err);
  res.status(500).json({ success: false, msg: err.message || "Internal Server Error" });
});

module.exports = app;

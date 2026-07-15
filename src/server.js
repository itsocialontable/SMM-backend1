require("dotenv").config();
const http = require("http");
const jwt  = require("jsonwebtoken");
const { Server } = require("socket.io");
const app       = require("./app");
const connectDB = require("./config/db");

connectDB();

try { require("./workers/post.worker"); }
catch (e) { console.log("  Post worker skipped:", e.message); }

const server = http.createServer(app);

// FIXED v19.1: socket.io CORS bhi ab REST API (app.js) jaisi hi dynamic,
// .env-driven origin list use karta hai — pehle yahan bhi hardcoded
// 4 origins thi jo doosre PC/domain se socket connection fail kar deti thi
// (real-time notifications waha kaam nahi karti thi).
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...envOrigins,
  process.env.FRONTEND_URL,
  "http://localhost:8080",
  "https://ornate-cocada-431ffc.netlify.app",
  "http://localhost:3000",
  "http://localhost:4000",
  "http://localhost:5173"
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  }
});


app.set("io", io);

try {
  const publishScheduledPosts = require("./jobs/publishScheduledPosts.job");
  publishScheduledPosts(io);
} catch (e) { console.log("⚠️  Scheduled job skipped:", e.message); }

try {
  const syncAnalytics = require("./jobs/syncAnalytics.job");
  syncAnalytics();
} catch (e) { console.log("⚠️  Analytics sync job skipped:", e.message); }

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch { return next(new Error("Unauthorized")); }
});

io.on("connection", (socket) => {
  socket.on("join", () => socket.join(socket.user.id));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// // // ==========================================
// // // FILE: src/controllers/posts/post.controller.js
// // // FIXED v16:
// // //   - scheduleDate / scheduleTime null bug fixed
// // //   - Combined parsing: scheduleAt OR (scheduleDate + scheduleTime)
// // //   - Backward compatible with scheduleAt ISO string too
// // // ==========================================

// // const Post               = require("../../models/post.model");
// // const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
// // const postQueue           = require("../../queues/post.queue");
// // const { cleanupTempFiles } = require("../../middleware/upload.middleware");

// // // ──────────────────────────────────────────────────────────────────
// // // HELPER: Resolve schedule datetime from multiple frontend formats
// // //
// // // Frontend can send:
// // //   1. scheduleAt: "2024-12-25T14:30:00.000Z"  (ISO — old way)
// // //   2. scheduleDate: "2024-12-25", scheduleTime: "14:30" (new way)
// // //   3. Both (scheduleAt takes priority)
// // //
// // // Returns { scheduleDate, scheduleTime, scheduleAtDate } or null values
// // // ──────────────────────────────────────────────────────────────────
// // const resolveSchedule = (body) => {
// //   const { scheduleAt, scheduleDate, scheduleTime } = body;

// //   let resolvedDate = null;   // "YYYY-MM-DD"
// //   let resolvedTime = null;   // "HH:mm"
// //   let resolvedAt   = null;   // JS Date object

// //   // Priority 1: Full ISO scheduleAt
// //   if (scheduleAt && scheduleAt.trim() !== "") {
// //     const dt = new Date(scheduleAt);
// //     if (!isNaN(dt.getTime())) {
// //       resolvedAt   = dt;
// //       // Extract date/time parts for storage
// //       resolvedDate = dt.toISOString().split("T")[0];
// //       resolvedTime = dt.toISOString().split("T")[1].slice(0, 5);
// //     }
// //   }

// //   // Priority 2: Separate scheduleDate + scheduleTime
// //   if (!resolvedAt && scheduleDate && scheduleDate.trim() !== "") {
// //     const timeStr = (scheduleTime && scheduleTime.trim() !== "") ? scheduleTime.trim() : "00:00";
// //     const combined = `${scheduleDate.trim()}T${timeStr}:00`;
// //     const dt = new Date(combined);
// //     if (!isNaN(dt.getTime())) {
// //       resolvedAt   = dt;
// //       resolvedDate = scheduleDate.trim();
// //       resolvedTime = timeStr;
// //     }
// //   }

// //   return { resolvedAt, resolvedDate, resolvedTime };
// // };

// // // ──────────────────────────────────────────────────────────────────
// // // HELPER: Upload files to Cloudinary
// // // ──────────────────────────────────────────────────────────────────
// // const uploadFiles = async (files) => {
// //   const mediaArray = [];
// //   for (const file of files) {
// //     console.log("⬆️ Uploading to Cloudinary:", file.originalname, "| Size:", file.size, "bytes");
// //     const result = await uploadToCloudinary(file.path, file.mimetype, "smm-uploads");
// //     console.log("✅ Cloudinary result:", result.secure_url);
// //     mediaArray.push({
// //       url:       result.secure_url,
// //       public_id: result.public_id,
// //       type:      result.resource_type,
// //       format:    result.format,
// //       bytes:     result.bytes
// //     });
// //   }
// //   return mediaArray;
// // };

// // // ──────────────────────────────────────────────────────────────────
// // // CREATE POST
// // // POST /api/posts/create
// // // ──────────────────────────────────────────────────────────────────
// // exports.createPost = async (req, res) => {
// //   try {
// //     console.log("📦 req.body =>", req.body);
// //     console.log("📁 req.files =>", req.files?.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));

// //     const { content, platforms, tags } = req.body;

// //     if (!req.user?.id) {
// //       cleanupTempFiles(req.files);
// //       return res.status(401).json({ success: false, msg: "Unauthorized" });
// //     }

// //     if (!content || !content.trim()) {
// //       cleanupTempFiles(req.files);
// //       return res.status(400).json({ success: false, msg: "Content is required" });
// //     }

// //     if (!platforms) {
// //       cleanupTempFiles(req.files);
// //       return res.status(400).json({ success: false, msg: "At least one platform is required" });
// //     }

// //     // ── FIX: Resolve schedule from any frontend format ──────────────
// //     const { resolvedAt, resolvedDate, resolvedTime } = resolveSchedule(req.body);

// //     if (resolvedAt && resolvedAt <= new Date()) {
// //       cleanupTempFiles(req.files);
// //       return res.status(400).json({ success: false, msg: "Schedule time must be in the future" });
// //     }

// //     // ── Upload media ────────────────────────────────────────────────
// //     let mediaArray = [];
// //     if (req.files && req.files.length > 0) {
// //       mediaArray = await uploadFiles(req.files);
// //       cleanupTempFiles(req.files);
// //     }

// //     const delay = resolvedAt ? Math.max(resolvedAt - new Date(), 0) : 0;

// //     const post = await Post.create({
// //       user:      req.user.id,
// //       content,
// //       media:     mediaArray,
// //       platforms: Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim()),
// //       tags:      tags ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim())) : [],
// //       scheduleAt:   resolvedAt,
// //       scheduleDate: resolvedDate,   // ✅ stored for frontend display
// //       scheduleTime: resolvedTime,   // ✅ stored for frontend display
// //       status:       resolvedAt ? "scheduled" : "queued",
// //       analyticsSource: "mock"
// //     });

// //     await postQueue.add("publish-post", { postId: post._id }, { delay });

// //     return res.status(201).json({
// //       success: true,
// //       msg:     resolvedAt ? "Post scheduled successfully" : "Post queued successfully",
// //       data:    post
// //     });

// //   } catch (err) {
// //     cleanupTempFiles(req.files);
// //     console.error("❌ CREATE POST ERROR =>", err);
// //     return res.status(500).json({ success: false, msg: err.message });
// //   }
// // };

// // // ──────────────────────────────────────────────────────────────────
// // exports.getQueuedPosts = async (req, res) => {
// //   try {
// //     const posts = await Post.find({
// //       user:   req.user.id,
// //       status: { $in: ["queued", "scheduled"] }
// //     }).sort({ createdAt: -1 });

// //     return res.status(200).json({ success: true, count: posts.length, data: posts });
// //   } catch (err) {
// //     return res.status(500).json({ success: false, msg: err.message });
// //   }
// // };

// // exports.getPublishedPosts = async (req, res) => {
// //   try {
// //     const posts = await Post.find({
// //       user:   req.user.id,
// //       status: "published"
// //     }).sort({ publishedAt: -1 });

// //     return res.status(200).json({ success: true, count: posts.length, data: posts });
// //   } catch (err) {
// //     return res.status(500).json({ success: false, msg: err.message });
// //   }
// // };

// // ==========================================
// // FILE: src/controllers/posts/post.controller.js
// // UPDATED v18: PLATFORM KA CORE RULE — SMM apne liye post publish
// //   nahi karta. SMM hamesha apni agency ke ek CLIENT ki taraf se
// //   (client se mile credentials/account use karke) post publish
// //   karta hai. Isliye clientId ab MANDATORY hai aur validate hota
// //   hai ki wo client SMM ki apni agency ka hi hai (warna koi SMM
// //   doosri agency ke client ke liye post bhi bana sakta tha).
// // ==========================================

// const Post               = require("../../models/post.model");
// const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
// const postQueue           = require("../../queues/post.queue");
// const { cleanupTempFiles } = require("../../middleware/upload.middleware");
// const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

// // ──────────────────────────────────────────────────────────────────
// // HELPER: Resolve schedule datetime from multiple frontend formats
// // ──────────────────────────────────────────────────────────────────
// const resolveSchedule = (body) => {
//   const { scheduleAt, scheduleDate, scheduleTime } = body;

//   let resolvedDate = null;
//   let resolvedTime = null;
//   let resolvedAt   = null;

//   if (scheduleAt && scheduleAt.trim() !== "") {
//     const dt = new Date(scheduleAt);
//     if (!isNaN(dt.getTime())) {
//       resolvedAt   = dt;
//       resolvedDate = dt.toISOString().split("T")[0];
//       resolvedTime = dt.toISOString().split("T")[1].slice(0, 5);
//     }
//   }

//   if (!resolvedAt && scheduleDate && scheduleDate.trim() !== "") {
//     const timeStr = (scheduleTime && scheduleTime.trim() !== "") ? scheduleTime.trim() : "00:00";
//     const combined = `${scheduleDate.trim()}T${timeStr}:00`;
//     const dt = new Date(combined);
//     if (!isNaN(dt.getTime())) {
//       resolvedAt   = dt;
//       resolvedDate = scheduleDate.trim();
//       resolvedTime = timeStr;
//     }
//   }

//   return { resolvedAt, resolvedDate, resolvedTime };
// };

// // ──────────────────────────────────────────────────────────────────
// // HELPER: Upload files to Cloudinary
// // ──────────────────────────────────────────────────────────────────
// const uploadFiles = async (files) => {
//   const mediaArray = [];
//   for (const file of files) {
//     console.log("⬆️ Uploading to Cloudinary:", file.originalname, "| Size:", file.size, "bytes");
//     const result = await uploadToCloudinary(file.path, file.mimetype, "smm-uploads");
//     console.log("✅ Cloudinary result:", result.secure_url);
//     mediaArray.push({
//       url:       result.secure_url,
//       public_id: result.public_id,
//       type:      result.resource_type,
//       format:    result.format,
//       bytes:     result.bytes
//     });
//   }
//   return mediaArray;
// };

// // ──────────────────────────────────────────────────────────────────
// // CREATE POST
// // POST /api/posts/create
// // ──────────────────────────────────────────────────────────────────
// exports.createPost = async (req, res) => {
//   try {
//     console.log("📦 req.body =>", req.body);
//     console.log("📁 req.files =>", req.files?.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));

//     const {
//       content,
//       platforms,
//       tags,
//       youtubeTitle,
//       youtubePrivacy,
//       clientId          // ← NEW: SMM kis client ke liye post kar raha hai
//     } = req.body;

//     if (!req.user?.id) {
//       cleanupTempFiles(req.files);
//       return res.status(401).json({ success: false, msg: "Unauthorized" });
//     }

//     if (!content || !content.trim()) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: "Content is required" });
//     }

//     if (!platforms) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: "At least one platform is required" });
//     }

//     // ── v18: clientId MANDATORY — SMM hamesha client ki taraf se post karta hai ──
//     const clientCheck = await validateClientForSmm(req.user.id, clientId);
//     if (!clientCheck.valid) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: clientCheck.reason });
//     }

//     // ── YouTube validation ──────────────────────────────────────────
//     const platformList = Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim());
//     if (platformList.includes("youtube")) {
//       const hasVideo = req.files?.some(f => f.mimetype.startsWith("video/"));
//       if (!hasVideo) {
//         cleanupTempFiles(req.files);
//         return res.status(400).json({ success: false, msg: "Video file is required for YouTube" });
//       }
//     }

//     // ── Resolve schedule ────────────────────────────────────────────
//     const { resolvedAt, resolvedDate, resolvedTime } = resolveSchedule(req.body);

//     if (resolvedAt && resolvedAt <= new Date()) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: "Schedule time must be in the future" });
//     }

//     // ── Upload media ────────────────────────────────────────────────
//     let mediaArray = [];
//     if (req.files && req.files.length > 0) {
//       mediaArray = await uploadFiles(req.files);
//       cleanupTempFiles(req.files);
//     }

//     const delay = resolvedAt ? Math.max(resolvedAt - new Date(), 0) : 0;

//     const post = await Post.create({
//       user:      req.user.id,
//       // ── v18: client ab MANDATORY hai aur upar validate ho chuka hai ──
//       client:    clientId,
//       content,
//       media:     mediaArray,
//       platforms: platformList,
//       tags:      tags ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim())) : [],
//       scheduleAt:      resolvedAt,
//       scheduleDate:    resolvedDate,
//       scheduleTime:    resolvedTime,
//       status:          resolvedAt ? "scheduled" : "queued",
//       analyticsSource: "mock",
//       // ── YouTube fields ──
//       youtubeTitle:   youtubeTitle?.trim() || null,
//       youtubePrivacy: youtubePrivacy || "public"
//     });

//     await postQueue.add("publish-post", { postId: post._id }, { delay });

//     return res.status(201).json({
//       success: true,
//       msg:     resolvedAt ? "Post scheduled successfully" : "Post queued successfully",
//       data:    post
//     });

//   } catch (err) {
//     cleanupTempFiles(req.files);
//     console.error("❌ CREATE POST ERROR =>", err);
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// // ──────────────────────────────────────────────────────────────────
// // GET QUEUED POSTS
// // GET /api/posts/queued?clientId=<id>  (optional — sab clients ke liye nahi diya to)
// // ──────────────────────────────────────────────────────────────────
// exports.getQueuedPosts = async (req, res) => {
//   try {
//     const { clientId } = req.query;
//     const filter = { user: req.user.id, status: { $in: ["queued", "scheduled"] } };

//     if (clientId) {
//       const check = await validateClientForSmm(req.user.id, clientId);
//       if (!check.valid) return res.status(400).json({ success: false, msg: check.reason });
//       filter.client = clientId;
//     }

//     const posts = await Post.find(filter).sort({ createdAt: -1 });

//     return res.status(200).json({ success: true, count: posts.length, data: posts });
//   } catch (err) {
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// exports.getPublishedPosts = async (req, res) => {
//   try {
//     const { clientId } = req.query;
//     const filter = { user: req.user.id, status: "published" };

//     if (clientId) {
//       const check = await validateClientForSmm(req.user.id, clientId);
//       if (!check.valid) return res.status(400).json({ success: false, msg: check.reason });
//       filter.client = clientId;
//     }

//     const posts = await Post.find(filter).sort({ publishedAt: -1 });

//     return res.status(200).json({ success: true, count: posts.length, data: posts });
//   } catch (err) {
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };


// // ==========================================
// // FILE: src/controllers/posts/post.controller.js
// // FIXED v16:
// //   - scheduleDate / scheduleTime null bug fixed
// //   - Combined parsing: scheduleAt OR (scheduleDate + scheduleTime)
// //   - Backward compatible with scheduleAt ISO string too
// // ==========================================

// const Post               = require("../../models/post.model");
// const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
// const postQueue           = require("../../queues/post.queue");
// const { cleanupTempFiles } = require("../../middleware/upload.middleware");

// // ──────────────────────────────────────────────────────────────────
// // HELPER: Resolve schedule datetime from multiple frontend formats
// //
// // Frontend can send:
// //   1. scheduleAt: "2024-12-25T14:30:00.000Z"  (ISO — old way)
// //   2. scheduleDate: "2024-12-25", scheduleTime: "14:30" (new way)
// //   3. Both (scheduleAt takes priority)
// //
// // Returns { scheduleDate, scheduleTime, scheduleAtDate } or null values
// // ──────────────────────────────────────────────────────────────────
// const resolveSchedule = (body) => {
//   const { scheduleAt, scheduleDate, scheduleTime } = body;

//   let resolvedDate = null;   // "YYYY-MM-DD"
//   let resolvedTime = null;   // "HH:mm"
//   let resolvedAt   = null;   // JS Date object

//   // Priority 1: Full ISO scheduleAt
//   if (scheduleAt && scheduleAt.trim() !== "") {
//     const dt = new Date(scheduleAt);
//     if (!isNaN(dt.getTime())) {
//       resolvedAt   = dt;
//       // Extract date/time parts for storage
//       resolvedDate = dt.toISOString().split("T")[0];
//       resolvedTime = dt.toISOString().split("T")[1].slice(0, 5);
//     }
//   }

//   // Priority 2: Separate scheduleDate + scheduleTime
//   if (!resolvedAt && scheduleDate && scheduleDate.trim() !== "") {
//     const timeStr = (scheduleTime && scheduleTime.trim() !== "") ? scheduleTime.trim() : "00:00";
//     const combined = `${scheduleDate.trim()}T${timeStr}:00`;
//     const dt = new Date(combined);
//     if (!isNaN(dt.getTime())) {
//       resolvedAt   = dt;
//       resolvedDate = scheduleDate.trim();
//       resolvedTime = timeStr;
//     }
//   }

//   return { resolvedAt, resolvedDate, resolvedTime };
// };

// // ──────────────────────────────────────────────────────────────────
// // HELPER: Upload files to Cloudinary
// // ──────────────────────────────────────────────────────────────────
// const uploadFiles = async (files) => {
//   const mediaArray = [];
//   for (const file of files) {
//     console.log("⬆️ Uploading to Cloudinary:", file.originalname, "| Size:", file.size, "bytes");
//     const result = await uploadToCloudinary(file.path, file.mimetype, "smm-uploads");
//     console.log("✅ Cloudinary result:", result.secure_url);
//     mediaArray.push({
//       url:       result.secure_url,
//       public_id: result.public_id,
//       type:      result.resource_type,
//       format:    result.format,
//       bytes:     result.bytes
//     });
//   }
//   return mediaArray;
// };

// // ──────────────────────────────────────────────────────────────────
// // CREATE POST
// // POST /api/posts/create
// // ──────────────────────────────────────────────────────────────────
// exports.createPost = async (req, res) => {
//   try {
//     console.log("📦 req.body =>", req.body);
//     console.log("📁 req.files =>", req.files?.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));

//     const { content, platforms, tags } = req.body;

//     if (!req.user?.id) {
//       cleanupTempFiles(req.files);
//       return res.status(401).json({ success: false, msg: "Unauthorized" });
//     }

//     if (!content || !content.trim()) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: "Content is required" });
//     }

//     if (!platforms) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: "At least one platform is required" });
//     }

//     // ── FIX: Resolve schedule from any frontend format ──────────────
//     const { resolvedAt, resolvedDate, resolvedTime } = resolveSchedule(req.body);

//     if (resolvedAt && resolvedAt <= new Date()) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: "Schedule time must be in the future" });
//     }

//     // ── Upload media ────────────────────────────────────────────────
//     let mediaArray = [];
//     if (req.files && req.files.length > 0) {
//       mediaArray = await uploadFiles(req.files);
//       cleanupTempFiles(req.files);
//     }

//     const delay = resolvedAt ? Math.max(resolvedAt - new Date(), 0) : 0;

//     const post = await Post.create({
//       user:      req.user.id,
//       content,
//       media:     mediaArray,
//       platforms: Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim()),
//       tags:      tags ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim())) : [],
//       scheduleAt:   resolvedAt,
//       scheduleDate: resolvedDate,   // ✅ stored for frontend display
//       scheduleTime: resolvedTime,   // ✅ stored for frontend display
//       status:       resolvedAt ? "scheduled" : "queued",
//       analyticsSource: "mock"
//     });

//     await postQueue.add("publish-post", { postId: post._id }, { delay });

//     return res.status(201).json({
//       success: true,
//       msg:     resolvedAt ? "Post scheduled successfully" : "Post queued successfully",
//       data:    post
//     });

//   } catch (err) {
//     cleanupTempFiles(req.files);
//     console.error("❌ CREATE POST ERROR =>", err);
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// // ──────────────────────────────────────────────────────────────────
// exports.getQueuedPosts = async (req, res) => {
//   try {
//     const posts = await Post.find({
//       user:   req.user.id,
//       status: { $in: ["queued", "scheduled"] }
//     }).sort({ createdAt: -1 });

//     return res.status(200).json({ success: true, count: posts.length, data: posts });
//   } catch (err) {
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// exports.getPublishedPosts = async (req, res) => {
//   try {
//     const posts = await Post.find({
//       user:   req.user.id,
//       status: "published"
//     }).sort({ publishedAt: -1 });

//     return res.status(200).json({ success: true, count: posts.length, data: posts });
//   } catch (err) {
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// ==========================================
// FILE: src/controllers/posts/post.controller.js
// UPDATED v18: PLATFORM KA CORE RULE — SMM apne liye post publish
//   nahi karta. SMM hamesha apni agency ke ek CLIENT ki taraf se
//   (client se mile credentials/account use karke) post publish
//   karta hai. Isliye clientId ab MANDATORY hai aur validate hota
//   hai ki wo client SMM ki apni agency ka hi hai (warna koi SMM
//   doosri agency ke client ke liye post bhi bana sakta tha).
// ==========================================

const Post               = require("../../models/post.model");
const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
const postQueue           = require("../../queues/post.queue");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");
const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

// ──────────────────────────────────────────────────────────────────
// HELPER: Resolve schedule datetime from multiple frontend formats
// ──────────────────────────────────────────────────────────────────
const resolveSchedule = (body) => {
  const { scheduleAt, scheduleDate, scheduleTime } = body;

  let resolvedDate = null;
  let resolvedTime = null;
  let resolvedAt   = null;

  if (scheduleAt && scheduleAt.trim() !== "") {
    const dt = new Date(scheduleAt);
    if (!isNaN(dt.getTime())) {
      resolvedAt   = dt;
      resolvedDate = dt.toISOString().split("T")[0];
      resolvedTime = dt.toISOString().split("T")[1].slice(0, 5);
    }
  }

  if (!resolvedAt && scheduleDate && scheduleDate.trim() !== "") {
    const timeStr = (scheduleTime && scheduleTime.trim() !== "") ? scheduleTime.trim() : "00:00";
    // FIXED: pehle yahan koi timezone specify nahi tha, isliye JS is
    // string ko server ke apne local timezone (Render pe UTC) me
    // interpret karta tha — matlab jab tumne "11:45" (IST, India time)
    // socha, wo backend me "11:45 UTC" ban jaata tha, jo IST se 5:30
    // ghante aage hai. Isi wajah se posts apne asli time se ~5.5 ghante
    // late publish ho rahi thi. Ab "+05:30" explicitly add kiya hai
    // taaki ye hamesha IST ke roop me hi sahi interpret ho, chahe
    // server kisi bhi timezone me chal raha ho.
    const combined = `${scheduleDate.trim()}T${timeStr}:00+05:30`;
    const dt = new Date(combined);
    if (!isNaN(dt.getTime())) {
      resolvedAt   = dt;
      resolvedDate = scheduleDate.trim();
      resolvedTime = timeStr;
    }
  }

  return { resolvedAt, resolvedDate, resolvedTime };
};

// ──────────────────────────────────────────────────────────────────
// HELPER: Upload files to Cloudinary
// ──────────────────────────────────────────────────────────────────
const uploadFiles = async (files) => {
  const mediaArray = [];
  for (const file of files) {
    console.log("⬆️ Uploading to Cloudinary:", file.originalname, "| Size:", file.size, "bytes");
    const result = await uploadToCloudinary(file.path, file.mimetype, "smm-uploads");
    console.log("✅ Cloudinary result:", result.secure_url);
    mediaArray.push({
      url:       result.secure_url,
      public_id: result.public_id,
      type:      result.resource_type,
      format:    result.format,
      bytes:     result.bytes
    });
  }
  return mediaArray;
};

// ──────────────────────────────────────────────────────────────────
// CREATE POST
// POST /api/posts/create
// ──────────────────────────────────────────────────────────────────
exports.createPost = async (req, res) => {
  try {
    console.log("📦 req.body =>", req.body);
    console.log("📁 req.files =>", req.files?.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));

    const {
      content,
      platforms,
      tags,
      youtubeTitle,
      youtubePrivacy,
      clientId,          // ← NEW: SMM kis client ke liye post kar raha hai
      // v21: agar kisi platform (jaise Facebook) ke multiple connected
      // accounts hain is client ke, user yahan specify karega konsi
      // account/Page pe publish karni hai. Optional — [{platform, accountId}]
      platformAccounts
    } = req.body;

    if (!req.user?.id) {
      cleanupTempFiles(req.files);
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    if (!content || !content.trim()) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ success: false, msg: "Content is required" });
    }

    if (!platforms) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ success: false, msg: "At least one platform is required" });
    }

    // ── v18: clientId MANDATORY — SMM hamesha client ki taraf se post karta hai ──
    const clientCheck = await validateClientForSmm(req.user.id, clientId);
    if (!clientCheck.valid) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ success: false, msg: clientCheck.reason });
    }

    // ── YouTube validation ──────────────────────────────────────────
    const platformList = Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim());
    if (platformList.includes("youtube")) {
      const hasVideo = req.files?.some(f => f.mimetype.startsWith("video/"));
      if (!hasVideo) {
        cleanupTempFiles(req.files);
        return res.status(400).json({ success: false, msg: "Video file is required for YouTube" });
      }
    }

    // ── Resolve schedule ────────────────────────────────────────────
    const { resolvedAt, resolvedDate, resolvedTime } = resolveSchedule(req.body);

    if (resolvedAt && resolvedAt <= new Date()) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ success: false, msg: "Schedule time must be in the future" });
    }

    // ── Upload media ────────────────────────────────────────────────
    let mediaArray = [];
    if (req.files && req.files.length > 0) {
      mediaArray = await uploadFiles(req.files);
      cleanupTempFiles(req.files);
    }

    // ── v21: platformAccounts multipart/form-data se aksar JSON string
    // ke roop me aata hai (form-data me nested arrays/objects seedhe
    // nahi ja sakte) — safely parse karo, agar galat/missing ho to
    // bas khaali array (matlab "default account use karo") ──
    let platformAccountsParsed = [];
    if (platformAccounts) {
      try {
        platformAccountsParsed = typeof platformAccounts === "string"
          ? JSON.parse(platformAccounts)
          : platformAccounts;
      } catch {
        platformAccountsParsed = [];
      }
    }

    const delay = resolvedAt ? Math.max(resolvedAt - new Date(), 0) : 0;

    const post = await Post.create({
      user:      req.user.id,
      // ── v18: client ab MANDATORY hai aur upar validate ho chuka hai ──
      client:    clientId,
      content,
      media:     mediaArray,
      platforms: platformList,
      platformAccounts: platformAccountsParsed,
      tags:      tags ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim())) : [],
      scheduleAt:      resolvedAt,
      scheduleDate:    resolvedDate,
      scheduleTime:    resolvedTime,
      status:          resolvedAt ? "scheduled" : "queued",
      analyticsSource: "mock",
      // ── YouTube fields ──
      youtubeTitle:   youtubeTitle?.trim() || null,
      youtubePrivacy: youtubePrivacy || "public"
    });

    await postQueue.add("publish-post", { postId: post._id }, { delay });

    return res.status(201).json({
      success: true,
      msg:     resolvedAt ? "Post scheduled successfully" : "Post queued successfully",
      data:    post
    });

  } catch (err) {
    cleanupTempFiles(req.files);
    console.error("❌ CREATE POST ERROR =>", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};

// ──────────────────────────────────────────────────────────────────
// GET QUEUED POSTS
// GET /api/posts/queued?clientId=<id>  (optional — sab clients ke liye nahi diya to)
// ──────────────────────────────────────────────────────────────────
exports.getQueuedPosts = async (req, res) => {
  try {
    const { clientId } = req.query;
    const filter = { user: req.user.id, status: { $in: ["queued", "scheduled"] } };

    if (clientId) {
      const check = await validateClientForSmm(req.user.id, clientId);
      if (!check.valid) return res.status(400).json({ success: false, msg: check.reason });
      filter.client = clientId;
    }

    const posts = await Post.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message });
  }
};

exports.getPublishedPosts = async (req, res) => {
  try {
    const { clientId } = req.query;
    const filter = { user: req.user.id, status: "published" };

    if (clientId) {
      const check = await validateClientForSmm(req.user.id, clientId);
      if (!check.valid) return res.status(400).json({ success: false, msg: check.reason });
      filter.client = clientId;
    }

    // v20: client ka naam/company bhi bhejo — abhi tak sirf client ID
    // aata tha, frontend ko pata nahi chalta tha ye post kis client
    // ke liye publish hua hai.
    const posts = await Post.find(filter)
      .sort({ publishedAt: -1 })
      .populate("client", "name companyName email profileImage");

    return res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message });
  }
};
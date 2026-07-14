// const Post               = require("../../models/post.model");
// const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
// const { cleanupTempFiles } = require("../../middleware/upload.middleware");
// const postQueue            = require("../../queues/post.queue");
// const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

// // Same helper as post.controller.js — supports 3 formats:
// //   1. scheduleAt: "2026-06-07T10:30:00.000Z"  (ISO string)
// //   2. scheduleDate: "2026-06-07", scheduleTime: "10:30"  (separate fields)
// //   3. Both (scheduleAt takes priority)
// const resolveSchedule = (body) => {
//   const { scheduleAt, scheduleDate, scheduleTime } = body;
//   let resolvedDate = null;
//   let resolvedTime = null;
//   let resolvedAt   = null;

//   if (scheduleAt && scheduleAt.toString().trim() !== "") {
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

// // ✅ Helper: files ko Cloudinary pe upload karo
// const uploadFiles = async (files, folder = "smm-uploads/drafts") => {
//   const mediaArray = [];
//   for (const file of files) {
//     // ✅ file.path use karo (disk storage) — pehle file.buffer tha (RAM)
//     const result = await uploadToCloudinary(file.path, file.mimetype, folder);
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

// // ================= SAVE DRAFT =================
// // v18: clientId MANDATORY hai — draft bhi hamesha kisi client ke
// // liye banaya jaata hai (SMM apne liye nahi). Pehle ye field
// // controller me handle hi nahi hota tha — sirf model me chhup ke
// // reh jaata, draft kabhi kisi client se linked hi nahi hota tha.
// exports.saveDraft = async (req, res) => {
//   try {
//     const { content, platforms, tags, clientId, youtubeTitle, youtubePrivacy } = req.body;

//     if (!req.user?.id) {
//       cleanupTempFiles(req.files);
//       return res.status(401).json({ success: false, msg: "Unauthorized" });
//     }

//     const clientCheck = await validateClientForSmm(req.user.id, clientId);
//     if (!clientCheck.valid) {
//       cleanupTempFiles(req.files);
//       return res.status(400).json({ success: false, msg: clientCheck.reason });
//     }

//     // ✅ Media upload to Cloudinary
//     let mediaArray = [];
//     if (req.files?.length) {
//       mediaArray = await uploadFiles(req.files);
//       cleanupTempFiles(req.files); // ✅ temp files delete
//     }

//     const draft = await Post.create({
//       user: req.user.id,
//       client: clientId,
//       content: content || "",

//       platforms: platforms
//         ? (Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim()))
//         : [],

//       tags: tags
//         ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim()))
//         : [],

//       media: mediaArray,
//       youtubeTitle:   youtubeTitle?.trim() || null,
//       youtubePrivacy: youtubePrivacy || "public",
//       status: "draft"
//     });

//     return res.status(201).json({
//       success: true,
//       msg: "Draft saved successfully",
//       data: draft
//     });

//   } catch (err) {
//     cleanupTempFiles(req.files); // ✅ Error pe bhi cleanup
//     console.error("SAVE DRAFT ERROR =>", err);
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// // ================= GET ALL DRAFTS =================
// // Optional ?clientId= filter (validated)
// exports.getDrafts = async (req, res) => {
//   try {
//     const { clientId } = req.query;
//     const filter = { user: req.user.id, status: "draft" };

//     if (clientId) {
//       const check = await validateClientForSmm(req.user.id, clientId);
//       if (!check.valid) return res.status(400).json({ success: false, msg: check.reason });
//       filter.client = clientId;
//     }

//     const drafts = await Post.find(filter).sort({ updatedAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: drafts.length,
//       data: drafts
//     });

//   } catch (err) {
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// // ================= UPDATE DRAFT =================
// exports.updateDraft = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { content, platforms, tags, clientId, youtubeTitle, youtubePrivacy } = req.body;

//     const draft = await Post.findOne({ _id: id, user: req.user.id, status: "draft" });

//     if (!draft) {
//       cleanupTempFiles(req.files);
//       return res.status(404).json({ success: false, msg: "Draft not found" });
//     }

//     // ── v18: agar clientId badla ja raha hai to validate karo ──
//     if (clientId !== undefined && String(clientId) !== String(draft.client)) {
//       const check = await validateClientForSmm(req.user.id, clientId);
//       if (!check.valid) {
//         cleanupTempFiles(req.files);
//         return res.status(400).json({ success: false, msg: check.reason });
//       }
//       draft.client = clientId;
//     }

//     // ✅ New files upload karo
//     let newMedia = [...draft.media];
//     if (req.files?.length) {
//       const uploaded = await uploadFiles(req.files);
//       cleanupTempFiles(req.files); // ✅ temp files delete
//       newMedia = [...newMedia, ...uploaded];
//     }

//     draft.content = content ?? draft.content;
//     draft.platforms = platforms
//       ? (Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim()))
//       : draft.platforms;
//     draft.tags = tags
//       ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim()))
//       : draft.tags;
//     draft.media = newMedia;
//     if (youtubeTitle    !== undefined) draft.youtubeTitle    = youtubeTitle?.trim() || null;
//     if (youtubePrivacy  !== undefined) draft.youtubePrivacy  = youtubePrivacy || "public";

//     await draft.save();

//     return res.status(200).json({
//       success: true,
//       msg: "Draft updated",
//       data: draft
//     });

//   } catch (err) {
//     cleanupTempFiles(req.files); // ✅ Error pe bhi cleanup
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };

// // ================= DELETE DRAFT =================
// exports.deleteDraft = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const draft = await Post.findOneAndDelete({ _id: id, user: req.user.id, status: "draft" });

//     if (!draft) {
//       return res.status(404).json({ success: false, msg: "Draft not found" });
//     }

//     return res.status(200).json({ success: true, msg: "Draft deleted" });

//   } catch (err) {
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };


// // ================= PUBLISH DRAFT =================
// // Draft ko directly publish ya schedule karo
// // PUT /api/posts/draft/:id/publish
// // Body (optional): scheduleAt (ISO date string)
// exports.publishDraft = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { resolvedAt, resolvedDate, resolvedTime } = resolveSchedule(req.body);

//     // ── Find draft ─────────────────────────────────────────────────
//     const draft = await Post.findOne({ _id: id, user: req.user.id, status: "draft" });

//     if (!draft) {
//       return res.status(404).json({
//         success: false,
//         msg: "Draft not found or already published"
//       });
//     }

//     // ── v18: client hona zaroori hai — SMM apne liye publish nahi karta ──
//     if (!draft.client) {
//       return res.status(400).json({
//         success: false,
//         msg: "This draft has no client linked — cannot publish. Edit the draft and set a clientId first."
//       });
//     }

//     // ── Empty content check ────────────────────────────────────────
//     if (!draft.content && !draft.media?.length) {
//       return res.status(400).json({
//         success: false,
//         msg: "Cannot publish empty draft — add content or media first"
//       });
//     }

//     // ── Platform check ─────────────────────────────────────────────
//     if (!draft.platforms?.length) {
//       return res.status(400).json({
//         success: false,
//         msg: "Cannot publish draft — no platforms selected"
//       });
//     }

//     let delay = 0;

//     if (resolvedAt) {
//       // Scheduled publish
//       if (resolvedAt <= new Date()) {
//         return res.status(400).json({
//           success: false,
//           msg: "Schedule time must be in the future"
//         });
//       }

//       delay              = resolvedAt - new Date();
//       draft.scheduleAt   = resolvedAt;
//       draft.scheduleDate = resolvedDate;
//       draft.scheduleTime = resolvedTime;
//       draft.status       = "scheduled";

//     } else {
//       // Immediate publish → queue
//       draft.status = "queued";
//     }

//     await draft.save();

//     // ── Add to BullMQ queue ────────────────────────────────────────
//     await postQueue.add(
//       "publish-post",
//       { postId: draft._id },
//       { delay }
//     );

//     return res.status(200).json({
//       success: true,
//       msg: resolvedAt
//         ? "Draft scheduled for publishing successfully"
//         : "Draft sent to publish queue successfully",
//       data: draft
//     });

//   } catch (err) {
//     console.error("PUBLISH DRAFT ERROR =>", err);
//     return res.status(500).json({ success: false, msg: err.message });
//   }
// };


const Post               = require("../../models/post.model");
const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");
const postQueue            = require("../../queues/post.queue");
const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

// Same helper as post.controller.js — supports 3 formats:
//   1. scheduleAt: "2026-06-07T10:30:00.000Z"  (ISO string)
//   2. scheduleDate: "2026-06-07", scheduleTime: "10:30"  (separate fields)
//   3. Both (scheduleAt takes priority)
const resolveSchedule = (body) => {
  const { scheduleAt, scheduleDate, scheduleTime } = body;
  let resolvedDate = null;
  let resolvedTime = null;
  let resolvedAt   = null;

  if (scheduleAt && scheduleAt.toString().trim() !== "") {
    const dt = new Date(scheduleAt);
    if (!isNaN(dt.getTime())) {
      resolvedAt   = dt;
      resolvedDate = dt.toISOString().split("T")[0];
      resolvedTime = dt.toISOString().split("T")[1].slice(0, 5);
    }
  }

  if (!resolvedAt && scheduleDate && scheduleDate.trim() !== "") {
    const timeStr = (scheduleTime && scheduleTime.trim() !== "") ? scheduleTime.trim() : "00:00";
    // FIXED: same wajah jaisi post.controller.js me — "+05:30" add kiya
    // taaki IST (India time) sahi se interpret ho, server timezone
    // (UTC) se nahi.
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

// ✅ Helper: files ko Cloudinary pe upload karo
const uploadFiles = async (files, folder = "smm-uploads/drafts") => {
  const mediaArray = [];
  for (const file of files) {
    // ✅ file.path use karo (disk storage) — pehle file.buffer tha (RAM)
    const result = await uploadToCloudinary(file.path, file.mimetype, folder);
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

// ================= SAVE DRAFT =================
// v18: clientId MANDATORY hai — draft bhi hamesha kisi client ke
// liye banaya jaata hai (SMM apne liye nahi). Pehle ye field
// controller me handle hi nahi hota tha — sirf model me chhup ke
// reh jaata, draft kabhi kisi client se linked hi nahi hota tha.
exports.saveDraft = async (req, res) => {
  try {
    const { content, platforms, tags, clientId, youtubeTitle, youtubePrivacy } = req.body;

    if (!req.user?.id) {
      cleanupTempFiles(req.files);
      return res.status(401).json({ success: false, msg: "Unauthorized" });
    }

    const clientCheck = await validateClientForSmm(req.user.id, clientId);
    if (!clientCheck.valid) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ success: false, msg: clientCheck.reason });
    }

    // ✅ Media upload to Cloudinary
    let mediaArray = [];
    if (req.files?.length) {
      mediaArray = await uploadFiles(req.files);
      cleanupTempFiles(req.files); // ✅ temp files delete
    }

    const draft = await Post.create({
      user: req.user.id,
      client: clientId,
      content: content || "",

      platforms: platforms
        ? (Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim()))
        : [],

      tags: tags
        ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim()))
        : [],

      media: mediaArray,
      youtubeTitle:   youtubeTitle?.trim() || null,
      youtubePrivacy: youtubePrivacy || "public",
      status: "draft"
    });

    return res.status(201).json({
      success: true,
      msg: "Draft saved successfully",
      data: draft
    });

  } catch (err) {
    cleanupTempFiles(req.files); // ✅ Error pe bhi cleanup
    console.error("SAVE DRAFT ERROR =>", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};

// ================= GET ALL DRAFTS =================
// Optional ?clientId= filter (validated)
exports.getDrafts = async (req, res) => {
  try {
    const { clientId } = req.query;
    const filter = { user: req.user.id, status: "draft" };

    if (clientId) {
      const check = await validateClientForSmm(req.user.id, clientId);
      if (!check.valid) return res.status(400).json({ success: false, msg: check.reason });
      filter.client = clientId;
    }

    const drafts = await Post.find(filter).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: drafts.length,
      data: drafts
    });

  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message });
  }
};

// ================= UPDATE DRAFT =================
exports.updateDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, platforms, tags, clientId, youtubeTitle, youtubePrivacy } = req.body;

    const draft = await Post.findOne({ _id: id, user: req.user.id, status: "draft" });

    if (!draft) {
      cleanupTempFiles(req.files);
      return res.status(404).json({ success: false, msg: "Draft not found" });
    }

    // ── v18: agar clientId badla ja raha hai to validate karo ──
    if (clientId !== undefined && String(clientId) !== String(draft.client)) {
      const check = await validateClientForSmm(req.user.id, clientId);
      if (!check.valid) {
        cleanupTempFiles(req.files);
        return res.status(400).json({ success: false, msg: check.reason });
      }
      draft.client = clientId;
    }

    // ✅ New files upload karo
    let newMedia = [...draft.media];
    if (req.files?.length) {
      const uploaded = await uploadFiles(req.files);
      cleanupTempFiles(req.files); // ✅ temp files delete
      newMedia = [...newMedia, ...uploaded];
    }

    draft.content = content ?? draft.content;
    draft.platforms = platforms
      ? (Array.isArray(platforms) ? platforms : platforms.split(",").map(p => p.trim()))
      : draft.platforms;
    draft.tags = tags
      ? (Array.isArray(tags) ? tags : tags.split(",").map(t => t.trim()))
      : draft.tags;
    draft.media = newMedia;
    if (youtubeTitle    !== undefined) draft.youtubeTitle    = youtubeTitle?.trim() || null;
    if (youtubePrivacy  !== undefined) draft.youtubePrivacy  = youtubePrivacy || "public";

    await draft.save();

    return res.status(200).json({
      success: true,
      msg: "Draft updated",
      data: draft
    });

  } catch (err) {
    cleanupTempFiles(req.files); // ✅ Error pe bhi cleanup
    return res.status(500).json({ success: false, msg: err.message });
  }
};

// ================= DELETE DRAFT =================
exports.deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;

    const draft = await Post.findOneAndDelete({ _id: id, user: req.user.id, status: "draft" });

    if (!draft) {
      return res.status(404).json({ success: false, msg: "Draft not found" });
    }

    return res.status(200).json({ success: true, msg: "Draft deleted" });

  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message });
  }
};


// ================= PUBLISH DRAFT =================
// Draft ko directly publish ya schedule karo
// PUT /api/posts/draft/:id/publish
// Body (optional): scheduleAt (ISO date string)
exports.publishDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolvedAt, resolvedDate, resolvedTime } = resolveSchedule(req.body);

    // ── Find draft ─────────────────────────────────────────────────
    const draft = await Post.findOne({ _id: id, user: req.user.id, status: "draft" });

    if (!draft) {
      return res.status(404).json({
        success: false,
        msg: "Draft not found or already published"
      });
    }

    // ── v18: client hona zaroori hai — SMM apne liye publish nahi karta ──
    if (!draft.client) {
      return res.status(400).json({
        success: false,
        msg: "This draft has no client linked — cannot publish. Edit the draft and set a clientId first."
      });
    }

    // ── Empty content check ────────────────────────────────────────
    if (!draft.content && !draft.media?.length) {
      return res.status(400).json({
        success: false,
        msg: "Cannot publish empty draft — add content or media first"
      });
    }

    // ── Platform check ─────────────────────────────────────────────
    if (!draft.platforms?.length) {
      return res.status(400).json({
        success: false,
        msg: "Cannot publish draft — no platforms selected"
      });
    }

    let delay = 0;

    if (resolvedAt) {
      // Scheduled publish
      if (resolvedAt <= new Date()) {
        return res.status(400).json({
          success: false,
          msg: "Schedule time must be in the future"
        });
      }

      delay              = resolvedAt - new Date();
      draft.scheduleAt   = resolvedAt;
      draft.scheduleDate = resolvedDate;
      draft.scheduleTime = resolvedTime;
      draft.status       = "scheduled";

    } else {
      // Immediate publish → queue
      draft.status = "queued";
    }

    await draft.save();

    // ── Add to BullMQ queue ────────────────────────────────────────
    await postQueue.add(
      "publish-post",
      { postId: draft._id },
      { delay }
    );

    return res.status(200).json({
      success: true,
      msg: resolvedAt
        ? "Draft scheduled for publishing successfully"
        : "Draft sent to publish queue successfully",
      data: draft
    });

  } catch (err) {
    console.error("PUBLISH DRAFT ERROR =>", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};
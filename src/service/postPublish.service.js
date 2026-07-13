// ==========================================
// FILE: src/service/postPublish.service.js
// NEW v18: Ek hi shared "publish a post" function — BullMQ worker
//   aur cron recovery job dono isi function ko call karte hain.
//   Pehle dono jagah alag-alag logic thi, jisse:
//     - Cron sirf status="published" kar deta tha bina kuch real
//       publish kiye (agar Redis down ho jaaye)
//     - Race condition possible thi dono ke beech
//   Ab dono isi single, real implementation ko call karte hain, aur
//   idempotency guard hai taaki double-publish na ho.
//
// FIX (v18): account.accessToken/refreshToken schema me
//   `select: false` hai — pehle worker me bina `.select("+accessToken")`
//   ke query hoti thi, jiski wajah se accessToken hamesha `undefined`
//   aata tha aur decrypt() crash kar jaata tha. Matlab YouTube publish
//   bhi practically hamesha fail ho raha tha. Fix kar diya.
// ==========================================

const Post           = require("../models/post.model");
const SocialAccount  = require("../models/socialAccount.model");
const { getValidAccessToken } = require("./tokenRefresh.service");
const { uploadVideoToYouTube } = require("./youtube.upload.service");
const {
  publishToTwitter,
  publishToLinkedIn,
  publishToFacebook,
  publishToInstagram,
  publishToPinterest,
  fetchFirstPinterestBoard
} = require("./socialPublish.service");

const axios = require("axios");
const path  = require("path");
const os    = require("os");
const fs    = require("fs");

// Cloudinary URL se temp file me download karna (YouTube upload ke liye chahiye)
const downloadToTemp = async (url, filename) => {
  const tempPath = path.join(os.tmpdir(), filename);
  const response = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(tempPath, response.data);
  return tempPath;
};

// v19: kitni der ke baad ek "stale" lock ko dobara claim kiya ja
// sakta hai (agar process crash ho gaya lock hold karte waqt, warna
// post hamesha ke liye atka reh jaata)
const LOCK_STALE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Ek post ko uske saare platforms par publish karta hai.
 * Idempotent hai — already-published post ko dobara skip kar deta hai.
 *
 * v19 FIX: pehle idempotency check-then-act tha (post read karo, status
 * check karo, phir end me save karo) — status sirf poore publish ke
 * baad DB me save hota tha. Agar publish 2min se zyada (cron grace
 * period) le le (e.g. bada YouTube video upload), to worker aur cron
 * recovery job dono ek saath same post publish kar sakte the
 * (duplicate publish risk). Ab findOneAndUpdate se ATOMIC claim hota
 * hai — sirf ek hi caller is post ko process kar payega.
 */
async function processPostPublish(postId) {
  const now         = new Date();
  const staleCutoff = new Date(now.getTime() - LOCK_STALE_MS);

  // ── ATOMIC CLAIM ──────────────────────────────────────────────
  const post = await Post.findOneAndUpdate(
    {
      _id:    postId,
      status: { $in: ["queued", "scheduled"] },
      $or: [
        { processingLockedAt: null },
        { processingLockedAt: { $lte: staleCutoff } } // stale lock — crashed process, reclaim allowed
      ]
    },
    { $set: { processingLockedAt: now } },
    { new: true }
  );

  if (!post) {
    // Ya to post exist nahi karta, ya already kisi aur caller ne claim
    // kar liya / already publish ho chuka hai — dono case me safe skip.
    const existing = await Post.findById(postId);
    if (!existing) {
      console.warn(`⚠️ processPostPublish: post ${postId} not found`);
      return null;
    }
    console.log(`ℹ️ processPostPublish: post ${postId} already ${existing.status === "published" ? "published" : "being processed by another job"}, skipping`);
    return existing;
  }

  post.status      = "published";
  post.publishedAt = new Date();
  post.results     = [];

  const mediaList = (post.media || []).map(m => ({
    url:  m.url,
    type: (m.type === "video" || /\.(mp4|mov|avi|mkv|webm)$/i.test(m.url || ""))
      ? "video" : "image"
  }));

  for (const platform of post.platforms) {

    // Multi-client account lookup — client ka account ya SMM ka apna
    const accountQuery = {
      user:     post.user,
      platform,
      isActive: true,
      client:   post.client || null
    };

    // FIX: accessToken/refreshToken select:false hain — explicitly
    // select karna zaroori hai, warna decrypt(undefined) crash karega
    const account = await SocialAccount
      .findOne(accountQuery)
      .select("+accessToken +refreshToken");

    if (!account) {
      post.results.push({ platform, status: "failed", error: "No connected account found" });
      continue;
    }

    let accessToken;
    try {
      accessToken = await getValidAccessToken(account);
    } catch (err) {
      post.results.push({ platform, status: "failed", error: "Token refresh failed: " + err.message });
      continue;
    }

    try {

      // ─────────────── YOUTUBE ───────────────
      if (platform === "youtube") {
        const videoMedia = mediaList.find(m => m.type === "video");

        if (!videoMedia) {
          post.results.push({ platform: "youtube", status: "failed", error: "No video found in post" });
          continue;
        }

        const tempPath = await downloadToTemp(videoMedia.url, `yt_upload_${postId}_${Date.now()}.mp4`);

        try {
          const result = await uploadVideoToYouTube(
            accessToken,
            { path: tempPath, originalname: `video_${postId}.mp4`, mimetype: "video/mp4" },
            {
              title:       post.youtubeTitle || post.content?.slice(0, 100) || "My Video",
              privacy:     post.youtubePrivacy || "public",
              description: post.content || "",
              tags:        post.tags || []
            }
          );

          post.results.push({ platform: "youtube", status: "success", postId: result.videoId, url: result.videoUrl });
          post.platformPostId = result.videoId;
          console.log("✅ YouTube video published:", result.videoUrl);

        } finally {
          fs.unlink(tempPath, () => {}); // best-effort cleanup, fail silently
        }

      // ─────────────── TWITTER ───────────────
      } else if (platform === "twitter") {
        const result = await publishToTwitter(accessToken, post.content, mediaList);
        post.results.push({ platform, ...result });

      // ─────────────── LINKEDIN ───────────────
      } else if (platform === "linkedin") {
        const result = await publishToLinkedIn(accessToken, account.accountId, post.content, mediaList);
        post.results.push({ platform, ...result });

      // ─────────────── FACEBOOK ───────────────
      } else if (platform === "facebook") {
        const result = await publishToFacebook(accessToken, account.accountId, post.content, mediaList);
        post.results.push({ platform, ...result });

      // ─────────────── INSTAGRAM ───────────────
      } else if (platform === "instagram") {
        const result = await publishToInstagram(accessToken, account.accountId, post.content, mediaList);
        post.results.push({ platform, ...result });

      // ─────────────── PINTEREST ───────────────
      } else if (platform === "pinterest") {
        let boardId = post.pinterestBoardId;
        if (!boardId) {
          boardId = await fetchFirstPinterestBoard(accessToken);
        }
        const result = await publishToPinterest(accessToken, post.content, mediaList, boardId);
        post.results.push({ platform, ...result });

      } else {
        post.results.push({ platform, status: "failed", error: `Unsupported platform: ${platform}` });
      }

    } catch (err) {
      console.error(`❌ ${platform} publish error:`, err.response?.data || err.message);
      post.results.push({
        platform,
        status: "failed",
        error: err.response?.data?.error?.message
          || err.response?.data?.message
          || err.message
      });
    }
  }

  // ── Agar saari platforms fail hui, overall status "failed" rakho ──
  const anySuccess = post.results.some(r => r.status === "success");
  if (!anySuccess && post.results.length) {
    post.status      = "failed";
    post.publishedAt = null;
  }

  // ── Mock analytics sirf jab real publish hua ho aur analyticsSource mock ho ──
  if (post.analyticsSource !== "real" && post.status === "published") {
    post.likes    = Math.floor(Math.random() * 500);
    post.comments = Math.floor(Math.random() * 120);
    post.shares   = Math.floor(Math.random() * 60);
    post.views    = Math.floor(Math.random() * 5000);
  }

  await post.save();
  console.log(`${post.status === "published" ? "✅" : "⚠️"} Post ${post.status}:`, post._id.toString());

  return post;
}

module.exports = { processPostPublish };

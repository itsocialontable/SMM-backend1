// ==========================================
// FILE: src/jobs/publishScheduledPosts.job.js
// UPDATED v18: Pehle ye cron sirf `post.status = "published"` kar deta
//   tha BINA kuch real publish kiye — matlab agar Redis/BullMQ down ho
//   (jo redis.config.js gracefully ignore karta hai), to sirf ye cron
//   chalta tha aur client ko lagta "post chala gaya" jabki kahin gaya
//   hi nahi tha. Saath me BullMQ worker se race-condition ka risk tha
//   (dono parallel ek hi post process karne ki koshish karte the).
//
// AB: Ye ek SAFETY-NET / RECOVERY job hai —
//   - BullMQ ko pehle chance deta hai (grace period rakha hai)
//   - Sirf un posts ko process karta hai jo "overdue" ho gaye hain
//     (scheduleAt nikal gaya + grace period bhi nikal gaya) — matlab
//     BullMQ job kisi reason se fire nahi hua (Redis down tha,
//     server restart hua, etc.)
//   - Same shared `processPostPublish()` use karta hai jo worker
//     use karta hai — isliye REAL publish hota hai, fake nahi.
//   - processPostPublish() khud idempotent hai (already published
//     post ko skip kar deta hai) — isliye worker se race-condition
//     nahi hoti.
// ==========================================

const cron = require("node-cron");
const Post = require("../models/post.model");
const { processPostPublish } = require("../service/postPublish.service");

// BullMQ ko pehle chance dene ke liye grace period
const GRACE_PERIOD_MS = 2 * 60 * 1000; // 2 minutes

const publishScheduledPosts = () => {

  // Har 2 minute me check karo
  cron.schedule("*/2 * * * *", async () => {

    try {

      const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

      // Sirf overdue posts — jinka scheduleAt + grace period nikal gaya
      // (matlab BullMQ ne already process kar liya hota to status
      // "published"/"failed" ho jaata, "scheduled" me nahi rehta)
      const overduePosts = await Post.find({
        status: "scheduled",
        scheduleAt: { $lte: cutoff }
      }).select("_id");

      if (!overduePosts.length) return;

      console.log(`🔁 Recovery job: ${overduePosts.length} overdue scheduled post(s) found — processing...`);

      for (const { _id } of overduePosts) {
        try {
          await processPostPublish(_id);
        } catch (err) {
          console.error(`❌ Recovery job failed for post ${_id}:`, err.message);
        }
      }

    } catch (error) {
      console.error("❌ Recovery job error:", error.message);
    }

  });

};

module.exports = publishScheduledPosts;

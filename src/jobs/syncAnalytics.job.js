// ==========================================
// FILE: src/jobs/syncAnalytics.job.js
// NEW v20: Har 3 ghante me saare published posts (Facebook, Instagram,
//   YouTube) ka REAL likes/comments/shares/views fetch karke DB update
//   karta hai. Pehle publish hote hi random mock numbers set ho jaate
//   the aur kabhi refresh nahi hote the — ab ye job hi single source
//   of truth hai analytics data ke liye.
// ==========================================

const cron = require("node-cron");
const { syncAllPublishedPostsAnalytics } = require("../service/analyticsSync.service");

const syncAnalytics = () => {

  // Har 3 ghante me chalega: 00:00, 03:00, 06:00 ...
  cron.schedule("0 */3 * * *", async () => {
    try {
      console.log("📊 Analytics sync job started...");
      await syncAllPublishedPostsAnalytics();
    } catch (error) {
      console.error("❌ Analytics sync job error:", error.message);
    }
  });

};

module.exports = syncAnalytics;

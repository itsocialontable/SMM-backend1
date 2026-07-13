// ==========================================
// FILE: src/workers/post.worker.js
// UPDATED v18: Saara publish-logic ab "service/postPublish.service.js"
//   me shared hai (worker + cron recovery job dono isi ko call karte
//   hain). Pehle yahan sirf YouTube real tha, baaki sab platforms
//   "mock success" daal dete the — ab Twitter/LinkedIn/Facebook/
//   Instagram/Pinterest sab real publish karte hain (socialPublish.service.js)
//   aur token expire hone par automatically refresh hota hai
//   (tokenRefresh.service.js).
// ==========================================

const { Worker } = require("bullmq");
const connection = require("../config/redis.config");
const { processPostPublish } = require("../service/postPublish.service");

const worker = new Worker(
  "post-queue",

  async (job) => {
    const { postId } = job.data;
    try {
      await processPostPublish(postId);
    } catch (err) {
      console.error("❌ Worker Error:", err.message);
      throw err; // BullMQ ko retry/fail track karne dene ke liye re-throw
    }
  },

  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
    settings: { maxRetriesPerRequest: null }
  }
);

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

module.exports = worker;

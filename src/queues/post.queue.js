const { Queue } = require("bullmq");
const connection = require("../config/redis.config");

const postQueue = new Queue("post-queue", { connection });

module.exports = postQueue;
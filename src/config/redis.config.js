const IORedis = require("ioredis");

let connection = null;

try {
  connection = new IORedis(
    process.env.REDIS_URL || "redis://127.0.0.1:6379",
    {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          console.log("⚠️  Redis unavailable — Post scheduling disabled. Baaki sab kaam karega.");
          return null;
        }
        return 1000;
      }
    }
  );
  connection.on("connect", () => console.log("✅ Redis Connected"));
  connection.on("error", () => {});
} catch (err) {
  console.log("⚠️  Redis init skipped:", err.message);
}

module.exports = connection;

// const IORedis = require("ioredis");

// let connection = null;

// try {
//   connection = new IORedis(
//     process.env.REDIS_URL || "redis://127.0.0.1:6379",
//     {
//       maxRetriesPerRequest: null,
//       enableOfflineQueue: false,
//       lazyConnect: true,
//       retryStrategy: (times) => {
//         if (times > 3) {
//           console.log("⚠️  Redis unavailable — Post scheduling disabled. Baaki sab kaam karega.");
//           return null;
//         }
//         return 1000;
//       }
//     }
//   );
//   connection.on("connect", () => console.log("✅ Redis Connected"));
//   connection.on("error", () => {});
// } catch (err) {
//   console.log("⚠️  Redis init skipped:", err.message);
// }

// module.exports = connection;


const IORedis = require("ioredis");

let connection = null;

try {
  connection = new IORedis(
    process.env.REDIS_URL || "redis://127.0.0.1:6379",
    {
      maxRetriesPerRequest: null,
      // FIXED: pehle "false" tha — isse jab Upstash idle connection
      // drop karta tha, ioredis usi waqt error throw kar deta tha
      // instead of command ko queue karke reconnect hone ka wait
      // karne ke, aur BullMQ worker ke internal blocking commands
      // fail ho jaate the. Ab true hai taaki temporary disconnect ke
      // dauraan commands safely queue ho jaayein.
      enableOfflineQueue: true,
      // FIXED: lazyConnect hata diya — connection server start hote
      // hi ban jaata hai, isliye worker turant ready rehta hai aur
      // reconnect-logic bhi shuru se active rehti hai.
      retryStrategy: (times) => {
        // FIXED: pehle 3 retries ke baad "null" return hota tha jisse
        // ioredis HAMESHA KE LIYE reconnect karna band kar deta tha —
        // ek baar Upstash ne idle connection drop kiya, worker ka
        // Redis connection permanently dead ho jaata tha, aur uske
        // baad koi bhi scheduled post apne exact time par publish
        // NAHI hoti thi — sirf 2-min cron recovery job usse "kuch der
        // baad" pick karta tha. Ab retry kabhi rukta nahi (capped
        // backoff), connection hamesha khud-ba-khud wapas aa jaata hai.
        const delay = Math.min(times * 500, 5000);
        return delay;
      },
      reconnectOnError: () => true
    }
  );
  connection.on("connect", () => console.log("✅ Redis Connected"));
  connection.on("error", (err) => console.log("⚠️  Redis error:", err.message));
  connection.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));
} catch (err) {
  console.log("⚠️  Redis init skipped:", err.message);
}

module.exports = connection;
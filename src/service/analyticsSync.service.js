// ==========================================
// FILE: src/service/analyticsSync.service.js
// NEW v20: Published posts ka REAL analytics data (Facebook, Instagram,
//   YouTube) fetch karke DB me save karta hai. Ye function har post ke
//   `results[]` array me se successful platform entries uthata hai,
//   us platform ke connected account ka token nikal ke insights fetch
//   karta hai, aur result.analytics + post-level totals update karta
//   hai. `analyticsSync.job.js` (cron) isi ko periodically call karta
//   hai — isliye UI me dikhne wala data ab static/random nahi,
//   background me automatically fresh hota rehta hai.
// ==========================================

const Post          = require("../models/post.model");
const SocialAccount = require("../models/socialAccount.model");
const { getValidAccessToken } = require("./tokenRefresh.service");
const {
  fetchFacebookPostInsights,
  fetchInstagramMediaInsights,
  fetchYouTubeVideoStats
} = require("./socialAnalytics.service");

// Sirf ye platforms abhi real-analytics support karte hain
const SUPPORTED_PLATFORMS = ["facebook", "instagram", "youtube"];

// account cache — ek hi post ke andar same user+platform+client ke
// liye baar baar DB query na karni pade
async function getAccount(cache, { user, platform, client }) {
  const key = `${user}_${platform}_${client || "null"}`;
  if (cache.has(key)) return cache.get(key);

  const account = await SocialAccount
    .findOne({ user, platform, client: client || null, isActive: true })
    .select("+accessToken +refreshToken");

  cache.set(key, account);
  return account;
}

/**
 * Ek single post ka real analytics refresh karta hai.
 * Idempotent-safe — bas latest values overwrite karta hai.
 */
async function syncPostAnalytics(post) {
  if (!post.results?.length) return post;

  const accountCache = new Map();
  let changed = false;

  for (const result of post.results) {
    if (result.status !== "success" || !result.postId) continue;
    if (!SUPPORTED_PLATFORMS.includes(result.platform)) continue;

    try {
      const account = await getAccount(accountCache, {
        user:     post.user,
        platform: result.platform,
        client:   post.client
      });

      if (!account) {
        // Account disconnect ho chuka ho sakta hai — skip, error nahi
        continue;
      }

      const accessToken = await getValidAccessToken(account);

      let stats;
      if (result.platform === "facebook") {
        stats = await fetchFacebookPostInsights(accessToken, result.postId);
      } else if (result.platform === "instagram") {
        stats = await fetchInstagramMediaInsights(accessToken, result.postId);
      } else if (result.platform === "youtube") {
        stats = await fetchYouTubeVideoStats(accessToken, result.postId);
      }

      if (stats) {
        result.analytics = stats;
        changed = true;
      }

    } catch (err) {
      console.log(`⚠️ Analytics sync failed for ${result.platform} (post ${post._id}):`, err.message);
    }
  }

  if (changed) {
    // Post-level totals = sum across all platforms (backward-compatible
    // single numbers jo purana analytics.controller.js already use karta hai)
    const totals = post.results.reduce(
      (acc, r) => {
        acc.likes    += r.analytics?.likes    || 0;
        acc.comments += r.analytics?.comments || 0;
        acc.shares   += r.analytics?.shares   || 0;
        acc.views    += r.analytics?.views    || 0;
        return acc;
      },
      { likes: 0, comments: 0, shares: 0, views: 0 }
    );

    post.likes    = totals.likes;
    post.comments = totals.comments;
    post.shares   = totals.shares;
    post.views    = totals.views;

    post.analyticsSource     = "real";
    post.lastAnalyticsSyncAt = new Date();

    post.markModified("results");
    await post.save();
  }

  return post;
}

/**
 * Saare published posts ka analytics refresh karta hai (cron job se call hota hai).
 * `sinceDays` — kitne purane posts tak refresh karna hai (bahut purane
 * posts baar baar fetch karne ka koi fayda nahi, engagement stabilize
 * ho chuki hoti hai).
 */
async function syncAllPublishedPostsAnalytics(sinceDays = 60) {
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const posts = await Post.find({
    status: "published",
    publishedAt: { $gte: cutoff },
    platforms: { $in: SUPPORTED_PLATFORMS }
  });

  console.log(`📊 Analytics sync: ${posts.length} published post(s) to refresh`);

  let successCount = 0;
  for (const post of posts) {
    try {
      await syncPostAnalytics(post);
      successCount++;
    } catch (err) {
      console.log(`❌ Analytics sync error for post ${post._id}:`, err.message);
    }
  }

  console.log(`📊 Analytics sync done: ${successCount}/${posts.length} post(s) updated`);
  return { total: posts.length, updated: successCount };
}

module.exports = { syncPostAnalytics, syncAllPublishedPostsAnalytics };

// // ==========================================
// // FILE: src/service/analyticsSync.service.js
// // NEW v20: Published posts ka REAL analytics data (Facebook, Instagram,
// //   YouTube) fetch karke DB me save karta hai. Ye function har post ke
// //   `results[]` array me se successful platform entries uthata hai,
// //   us platform ke connected account ka token nikal ke insights fetch
// //   karta hai, aur result.analytics + post-level totals update karta
// //   hai. `analyticsSync.job.js` (cron) isi ko periodically call karta
// //   hai — isliye UI me dikhne wala data ab static/random nahi,
// //   background me automatically fresh hota rehta hai.
// // ==========================================

// const Post          = require("../models/post.model");
// const SocialAccount = require("../models/socialAccount.model");
// const { getValidAccessToken } = require("./tokenRefresh.service");
// const {
//   fetchFacebookPostInsights,
//   fetchInstagramMediaInsights,
//   fetchYouTubeVideoStats,
//   fetchFacebookPageInsights,
//   fetchInstagramAccountInsights
// } = require("./socialAnalytics.service");

// // Account-level (profile views/reach) insights sirf ye platforms support
// // karte hain abhi
// const ACCOUNT_INSIGHTS_PLATFORMS = ["facebook", "instagram"];

// // Sirf ye platforms abhi real-analytics support karte hain
// const SUPPORTED_PLATFORMS = ["facebook", "instagram", "youtube"];

// // account cache — ek hi post ke andar same user+platform+client ke
// // liye baar baar DB query na karni pade
// async function getAccount(cache, { user, platform, client }) {
//   const key = `${user}_${platform}_${client || "null"}`;
//   if (cache.has(key)) return cache.get(key);

//   const account = await SocialAccount
//     .findOne({ user, platform, client: client || null, isActive: true })
//     .select("+accessToken +refreshToken");

//   cache.set(key, account);
//   return account;
// }

// /**
//  * Ek single post ka real analytics refresh karta hai.
//  * Idempotent-safe — bas latest values overwrite karta hai.
//  */
// async function syncPostAnalytics(post) {
//   if (!post.results?.length) return post;

//   const accountCache = new Map();
//   let changed = false;

//   for (const result of post.results) {
//     if (result.status !== "success" || !result.postId) continue;
//     if (!SUPPORTED_PLATFORMS.includes(result.platform)) continue;

//     try {
//       const account = await getAccount(accountCache, {
//         user:     post.user,
//         platform: result.platform,
//         client:   post.client
//       });

//       if (!account) {
//         // Account disconnect ho chuka ho sakta hai — skip, error nahi
//         continue;
//       }

//       const accessToken = await getValidAccessToken(account);

//       let stats;
//       if (result.platform === "facebook") {
//         stats = await fetchFacebookPostInsights(accessToken, result.postId);
//       } else if (result.platform === "instagram") {
//         stats = await fetchInstagramMediaInsights(accessToken, result.postId);
//       } else if (result.platform === "youtube") {
//         stats = await fetchYouTubeVideoStats(accessToken, result.postId);
//       }

//       if (stats) {
//         result.analytics = stats;
//         changed = true;
//       }

//     } catch (err) {
//       console.log(`⚠️ Analytics sync failed for ${result.platform} (post ${post._id}):`, err.message);
//     }
//   }

//   if (changed) {
//     // Post-level totals = sum across all platforms (backward-compatible
//     // single numbers jo purana analytics.controller.js already use karta hai)
//     const totals = post.results.reduce(
//       (acc, r) => {
//         acc.likes       += r.analytics?.likes       || 0;
//         acc.comments    += r.analytics?.comments    || 0;
//         acc.shares      += r.analytics?.shares      || 0;
//         acc.views       += r.analytics?.views       || 0;
//         acc.reach       += r.analytics?.reach       || 0;
//         acc.impressions += r.analytics?.impressions || 0;
//         return acc;
//       },
//       { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0 }
//     );

//     post.likes       = totals.likes;
//     post.comments    = totals.comments;
//     post.shares      = totals.shares;
//     post.views       = totals.views;
//     post.reach       = totals.reach;
//     post.impressions = totals.impressions;

//     post.analyticsSource     = "real";
//     post.lastAnalyticsSyncAt = new Date();

//     post.markModified("results");
//     await post.save();
//   }

//   return post;
// }

// /**
//  * Ek connected account (Facebook Page / Instagram Business account) ka
//  * account-level insights (reach + profile views) refresh karta hai.
//  * Post-level insights se ALAG hai — ye account ki khud ki insights hain
//  * (jaise "is hafte Page/profile kitni baar dekhi gayi"), post-wise
//  * likes/comments jaisi cheez nahi.
//  */
// async function syncAccountInsightsForAccount(account) {
//   try {
//     const accessToken = await getValidAccessToken(account);
//     let insights;

//     if (account.platform === "facebook") {
//       insights = await fetchFacebookPageInsights(accessToken, account.accountId);
//     } else if (account.platform === "instagram") {
//       insights = await fetchInstagramAccountInsights(accessToken, account.accountId);
//     } else {
//       return account;
//     }

//     account.profileViews       = insights.profileViews || 0;
//     account.accountReach       = insights.reach || 0;
//     account.accountImpressions = insights.impressions || 0;
//     account.lastInsightsSyncAt = new Date();

//     await account.save();
//   } catch (err) {
//     console.log(`⚠️ Account insights sync failed for ${account.platform} (${account._id}):`, err.message);
//   }

//   return account;
// }

// /**
//  * Saare active connected accounts (Facebook/Instagram) ka account-level
//  * insights (profile views/reach) refresh karta hai — cron job se call
//  * hota hai, dashboard "Profile Views" card isi data pe based hai.
//  */
// async function syncAllAccountInsights() {
//   const accounts = await SocialAccount
//     .find({ isActive: true, platform: { $in: ACCOUNT_INSIGHTS_PLATFORMS } })
//     .select("+accessToken +refreshToken");

//   console.log(`📊 Account insights sync: ${accounts.length} connected account(s) to refresh`);

//   let successCount = 0;
//   for (const account of accounts) {
//     try {
//       await syncAccountInsightsForAccount(account);
//       successCount++;
//     } catch (err) {
//       console.log(`❌ Account insights sync error for account ${account._id}:`, err.message);
//     }
//   }

//   console.log(`📊 Account insights sync done: ${successCount}/${accounts.length} account(s) updated`);
//   return { total: accounts.length, updated: successCount };
// }

// /**
//  * Saare published posts ka analytics refresh karta hai (cron job se call hota hai).
//  * `sinceDays` — kitne purane posts tak refresh karna hai (bahut purane
//  * posts baar baar fetch karne ka koi fayda nahi, engagement stabilize
//  * ho chuki hoti hai).
//  */
// async function syncAllPublishedPostsAnalytics(sinceDays = 60) {
//   const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

//   const posts = await Post.find({
//     status: "published",
//     publishedAt: { $gte: cutoff },
//     platforms: { $in: SUPPORTED_PLATFORMS }
//   });

//   console.log(`📊 Analytics sync: ${posts.length} published post(s) to refresh`);

//   let successCount = 0;
//   for (const post of posts) {
//     try {
//       await syncPostAnalytics(post);
//       successCount++;
//     } catch (err) {
//       console.log(`❌ Analytics sync error for post ${post._id}:`, err.message);
//     }
//   }

//   console.log(`📊 Analytics sync done: ${successCount}/${posts.length} post(s) updated`);
//   return { total: posts.length, updated: successCount };
// }

// module.exports = {
//   syncPostAnalytics,
//   syncAllPublishedPostsAnalytics,
//   syncAccountInsightsForAccount,
//   syncAllAccountInsights
// };


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
  fetchYouTubeVideoStats,
  fetchFacebookPageInsights,
  fetchInstagramAccountInsights,
  fetchThreadsMediaInsights
} = require("./socialAnalytics.service");

// Account-level (profile views/reach) insights sirf ye platforms support
// karte hain abhi (Threads account-level insights API abhi nahi deta)
const ACCOUNT_INSIGHTS_PLATFORMS = ["facebook", "instagram"];

// Sirf ye platforms abhi real-analytics support karte hain
const SUPPORTED_PLATFORMS = ["facebook", "instagram", "youtube", "threads"];

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
      } else if (result.platform === "threads") {
        stats = await fetchThreadsMediaInsights(accessToken, result.postId);
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
        acc.likes       += r.analytics?.likes       || 0;
        acc.comments    += r.analytics?.comments    || 0;
        acc.shares      += r.analytics?.shares      || 0;
        acc.views       += r.analytics?.views       || 0;
        acc.reach       += r.analytics?.reach       || 0;
        acc.impressions += r.analytics?.impressions || 0;
        return acc;
      },
      { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0 }
    );

    post.likes       = totals.likes;
    post.comments    = totals.comments;
    post.shares      = totals.shares;
    post.views       = totals.views;
    post.reach       = totals.reach;
    post.impressions = totals.impressions;

    post.analyticsSource     = "real";
    post.lastAnalyticsSyncAt = new Date();

    post.markModified("results");
    await post.save();
  }

  return post;
}

/**
 * Ek connected account (Facebook Page / Instagram Business account) ka
 * account-level insights (reach + profile views) refresh karta hai.
 * Post-level insights se ALAG hai — ye account ki khud ki insights hain
 * (jaise "is hafte Page/profile kitni baar dekhi gayi"), post-wise
 * likes/comments jaisi cheez nahi.
 */
async function syncAccountInsightsForAccount(account) {
  try {
    const accessToken = await getValidAccessToken(account);
    let insights;

    if (account.platform === "facebook") {
      insights = await fetchFacebookPageInsights(accessToken, account.accountId);
    } else if (account.platform === "instagram") {
      insights = await fetchInstagramAccountInsights(accessToken, account.accountId);
    } else {
      return account;
    }

    account.profileViews       = insights.profileViews || 0;
    account.accountReach       = insights.reach || 0;
    account.accountImpressions = insights.impressions || 0;
    account.lastInsightsSyncAt = new Date();

    await account.save();
  } catch (err) {
    console.log(`⚠️ Account insights sync failed for ${account.platform} (${account._id}):`, err.message);
  }

  return account;
}

/**
 * Saare active connected accounts (Facebook/Instagram) ka account-level
 * insights (profile views/reach) refresh karta hai — cron job se call
 * hota hai, dashboard "Profile Views" card isi data pe based hai.
 */
async function syncAllAccountInsights() {
  const accounts = await SocialAccount
    .find({ isActive: true, platform: { $in: ACCOUNT_INSIGHTS_PLATFORMS } })
    .select("+accessToken +refreshToken");

  console.log(`📊 Account insights sync: ${accounts.length} connected account(s) to refresh`);

  let successCount = 0;
  for (const account of accounts) {
    try {
      await syncAccountInsightsForAccount(account);
      successCount++;
    } catch (err) {
      console.log(`❌ Account insights sync error for account ${account._id}:`, err.message);
    }
  }

  console.log(`📊 Account insights sync done: ${successCount}/${accounts.length} account(s) updated`);
  return { total: accounts.length, updated: successCount };
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

module.exports = {
  syncPostAnalytics,
  syncAllPublishedPostsAnalytics,
  syncAccountInsightsForAccount,
  syncAllAccountInsights
};
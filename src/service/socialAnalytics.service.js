// ==========================================
// FILE: src/service/socialAnalytics.service.js
// UPDATED v20: Real analytics fetching activated.
//   - Purana `fetchMetaInsights` FB ke insights endpoint pe metric names
//     use kar raha tha jo Instagram media ke liye valid hi nahi the
//     (share_count IG pe exist nahi karta, aur FB/IG dono ke liye
//     same function galat tha). Ab FB aur IG alag-alag, correct
//     fields ke saath.
//   - Likes/comments seedha post/media object se lena zyada reliable
//     hai (`?fields=likes.summary(true),comments.summary(true)`)
//     bajaye "insights" endpoint ke, jisme extra permissions
//     (read_insights) aur Page-level access chahiye hote hain.
//   - YouTube stats function activate kiya — access_token (OAuth)
//     se call hota hai, static API key ki zaroorat nahi.
// UPDATED v21: Dashboard pe "Total Reach", "Total Impressions" aur
//   "Profile Views" bhi ab REAL platform data se aate hain (pehle ye
//   metrics track hi nahi hoti thi, sirf likes/comments/shares/views).
//   - Post-level: reach + impressions ab har platform ke insights call
//     se hi capture kiye jaate hain (jo call pehle se ho raha tha,
//     value bas discard ho rahi thi — ab return karte hain).
//   - Account-level (profile views): naya set of functions
//     (fetchInstagramAccountInsights / fetchFacebookPageInsights) jo
//     connected account/page ki khud ki insights fetch karte hain —
//     ye syncAnalytics.job.js se periodically SocialAccount doc pe
//     save hoti hai (dekho analyticsSync.service.js:syncAccountInsights).
//   - Koi bhi metric jo actual API se na mile (permission na ho,
//     ya platform support hi na kare — jaise YouTube pe "reach" jaisi
//     koi cheez exist nahi karti standard Data API me) wahan 0 return
//     hota hai, kabhi bhi random/hardcoded number nahi.
// ==========================================

const axios = require("axios");

// ================= FACEBOOK (Page Post) =================
// postId format: "{page-id}_{post-id}" — jo publishToFacebook() se
// milta hai aur post.results[].postId me already saved hota hai.
exports.fetchFacebookPostInsights = async (accessToken, postId) => {
  const stats = { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0 };

  try {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${postId}`,
      {
        params: {
          fields: "likes.summary(true).limit(0),comments.summary(true).limit(0),shares",
          access_token: accessToken
        }
      }
    );

    const data = res.data || {};
    stats.likes    = data.likes?.summary?.total_count || 0;
    stats.comments = data.comments?.summary?.total_count || 0;
    stats.shares   = data.shares?.count || 0;
    // views: Facebook page-post ke liye views sirf video posts pe milte hain (insights alag call, neeche)

  } catch (err) {
    console.log("Facebook Analytics Error:", err.response?.data || err.message);
    return stats;
  }

  // Reach/Impressions — alag "insights" call (read_insights permission
  // chahiye, isliye separate try/catch — na mile to basic counts (upar)
  // valid rehte hain, sirf ye do 0 reh jaate hain).
  try {
    const insightsRes = await axios.get(
      `https://graph.facebook.com/v18.0/${postId}/insights`,
      {
        params: {
          metric: "post_impressions,post_impressions_unique,post_video_views",
          access_token: accessToken
        }
      }
    );
    const values = insightsRes.data?.data || [];
    const impressions = values.find(v => v.name === "post_impressions");
    const reach        = values.find(v => v.name === "post_impressions_unique");
    const videoViews    = values.find(v => v.name === "post_video_views");

    stats.impressions = impressions?.values?.[0]?.value || 0;
    stats.reach        = reach?.values?.[0]?.value || 0;
    stats.views         = videoViews?.values?.[0]?.value || 0;
  } catch (insightErr) {
    console.log("Facebook insights (reach/impressions) error:", insightErr.response?.data?.error?.message || insightErr.message);
  }

  return stats;
};

// ================= INSTAGRAM (Media) =================
// postId format: IG media id — jo publishToInstagram() se milta hai
exports.fetchInstagramMediaInsights = async (accessToken, mediaId) => {
  try {
    // Basic counts
    const basicRes = await axios.get(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        params: {
          fields: "like_count,comments_count,media_type",
          access_token: accessToken
        }
      }
    );

    const basic = basicRes.data || {};
    let views = 0;
    let reach = 0;
    let impressions = 0;

    // Reach/impressions/plays — separate "insights" call
    // (VIDEO/REELS -> "plays", IMAGE/CAROUSEL -> "impressions")
    try {
      const metric = basic.media_type === "VIDEO" ? "plays,reach,impressions" : "impressions,reach";
      const insightsRes = await axios.get(
        `https://graph.facebook.com/v18.0/${mediaId}/insights`,
        { params: { metric, access_token: accessToken } }
      );
      const values = insightsRes.data?.data || [];
      const playsOrImpressions = values.find(v => v.name === "plays" || v.name === "impressions");
      const reachEntry         = values.find(v => v.name === "reach");
      const impressionsEntry   = values.find(v => v.name === "impressions");

      views       = playsOrImpressions?.values?.[0]?.value || 0;
      reach       = reachEntry?.values?.[0]?.value || 0;
      impressions = impressionsEntry?.values?.[0]?.value || (basic.media_type === "VIDEO" ? 0 : views);
    } catch (insightErr) {
      // Insights permission na ho to bas 0 rehne do, basic counts still valid hain
      console.log("Instagram insights (views) error:", insightErr.response?.data?.error?.message || insightErr.message);
    }

    return {
      likes:       basic.like_count || 0,
      comments:    basic.comments_count || 0,
      shares:      0, // Instagram Graph API shares count expose nahi karta
      views,
      reach,
      impressions
    };

  } catch (err) {
    console.log("Instagram Analytics Error:", err.response?.data || err.message);
    return { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0 };
  }
};

// ================= YOUTUBE (Video) =================
// videoId format: YouTube video ID — jo uploadVideoToYouTube() se milta
// hai (result.videoId), post.results[].postId me saved hota hai.
exports.fetchYouTubeVideoStats = async (accessToken, videoId) => {
  try {
    const res = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: { part: "statistics", id: videoId },
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const stats = res.data?.items?.[0]?.statistics;

    return {
      likes:       Number(stats?.likeCount || 0),
      comments:    Number(stats?.commentCount || 0),
      shares:      0, // YouTube API shares count expose nahi karta
      views:       Number(stats?.viewCount || 0),
      // YouTube Data API "reach" jaisi koi cheez expose nahi karti
      // (wo YouTube Analytics API me hoti hai, alag OAuth scope
      // chahiye) — isliye impressions ke liye views hi closest real
      // signal hai, reach abhi supported nahi (0, fake nahi banaya).
      reach:       0,
      impressions: Number(stats?.viewCount || 0)
    };

  } catch (err) {
    console.log("YouTube Analytics Error:", err.response?.data || err.message);
    return { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0 };
  }
};

// ================= FACEBOOK (Page — account level) =================
// pageId = SocialAccount.accountId, accessToken = Page access token.
// "Profile views" ke closest real Facebook Page metric "page_views_total"
// hai — Page ke profile/about section kitni baar dekha gaya.
exports.fetchFacebookPageInsights = async (accessToken, pageId) => {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}/insights`,
      {
        params: {
          metric: "page_impressions,page_impressions_unique,page_views_total",
          period: "day",
          access_token: accessToken
        }
      }
    );

    const values = res.data?.data || [];
    const sumAllPeriods = (name) => {
      const entry = values.find(v => v.name === name);
      if (!entry?.values?.length) return 0;
      return entry.values.reduce((sum, v) => sum + (v.value || 0), 0);
    };

    return {
      impressions:  sumAllPeriods("page_impressions"),
      reach:        sumAllPeriods("page_impressions_unique"),
      profileViews: sumAllPeriods("page_views_total")
    };

  } catch (err) {
    console.log("Facebook Page insights error:", err.response?.data?.error?.message || err.message);
    return { impressions: 0, reach: 0, profileViews: 0 };
  }
};

// ================= INSTAGRAM (Business account — account level) =================
// igUserId = SocialAccount.accountId (Instagram Business Account ID),
// accessToken = Page access token (facebook login) ya IG token (direct login).
exports.fetchInstagramAccountInsights = async (accessToken, igUserId) => {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${igUserId}/insights`,
      {
        params: {
          metric: "reach,profile_views",
          period: "day",
          access_token: accessToken
        }
      }
    );

    const values = res.data?.data || [];
    const sumAllPeriods = (name) => {
      const entry = values.find(v => v.name === name);
      if (!entry?.values?.length) return 0;
      return entry.values.reduce((sum, v) => sum + (v.value || 0), 0);
    };

    return {
      impressions:  0, // v21+ Graph API ne media-impressions hata diya, account-level "impressions" ab unsupported hai
      reach:        sumAllPeriods("reach"),
      profileViews: sumAllPeriods("profile_views")
    };

  } catch (err) {
    console.log("Instagram account insights error:", err.response?.data?.error?.message || err.message);
    return { impressions: 0, reach: 0, profileViews: 0 };
  }
};

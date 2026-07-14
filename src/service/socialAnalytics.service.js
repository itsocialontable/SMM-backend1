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
// ==========================================

const axios = require("axios");

// ================= FACEBOOK (Page Post) =================
// postId format: "{page-id}_{post-id}" — jo publishToFacebook() se
// milta hai aur post.results[].postId me already saved hota hai.
exports.fetchFacebookPostInsights = async (accessToken, postId) => {
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

    return {
      likes:    data.likes?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares:   data.shares?.count || 0,
      views:    0 // Facebook page-post ke liye views sirf video posts pe milte hain (insights alag call)
    };

  } catch (err) {
    console.log("Facebook Analytics Error:", err.response?.data || err.message);
    return { likes: 0, comments: 0, shares: 0, views: 0 };
  }
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

    // Reach/impressions/plays — separate "insights" call
    // (VIDEO/REELS -> "plays", IMAGE/CAROUSEL -> "impressions")
    try {
      const metric = basic.media_type === "VIDEO" ? "plays,reach" : "impressions,reach";
      const insightsRes = await axios.get(
        `https://graph.facebook.com/v18.0/${mediaId}/insights`,
        { params: { metric, access_token: accessToken } }
      );
      const values = insightsRes.data?.data || [];
      const playsOrImpressions = values.find(v => v.name === "plays" || v.name === "impressions");
      views = playsOrImpressions?.values?.[0]?.value || 0;
    } catch (insightErr) {
      // Insights permission na ho to bas 0 rehne do, basic counts still valid hain
      console.log("Instagram insights (views) error:", insightErr.response?.data?.error?.message || insightErr.message);
    }

    return {
      likes:    basic.like_count || 0,
      comments: basic.comments_count || 0,
      shares:   0, // Instagram Graph API shares count expose nahi karta
      views
    };

  } catch (err) {
    console.log("Instagram Analytics Error:", err.response?.data || err.message);
    return { likes: 0, comments: 0, shares: 0, views: 0 };
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
      likes:    Number(stats?.likeCount || 0),
      comments: Number(stats?.commentCount || 0),
      shares:   0, // YouTube API shares count expose nahi karta
      views:    Number(stats?.viewCount || 0)
    };

  } catch (err) {
    console.log("YouTube Analytics Error:", err.response?.data || err.message);
    return { likes: 0, comments: 0, shares: 0, views: 0 };
  }
};

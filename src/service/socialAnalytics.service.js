const axios = require("axios");
const SocialAccount = require("../models/socialAccount.model");

// ================= INSTAGRAM / FACEBOOK =================
exports.fetchMetaInsights = async (accessToken, postId) => {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v18.0/${postId}/insights`,
      {
        params: {
          metric: "like_count,comment_count,share_count,impressions",
          access_token: accessToken
        }
      }
    );

    const data = res.data?.data || [];

    return {
      likes: data[0]?.values?.[0]?.value || 0,
      comments: data[1]?.values?.[0]?.value || 0,
      shares: data[2]?.values?.[0]?.value || 0,
      views: data[3]?.values?.[0]?.value || 0
    };

  } catch (err) {
    console.log("Meta Insights Error:", err.message);

    return {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0
    };
  }
};



// const axios = require("axios");

// // ================= FACEBOOK / INSTAGRAM =================
// exports.fetchMetaInsights = async (accessToken, postId) => {
//   try {
//     const res = await axios.get(
//       `https://graph.facebook.com/v18.0/${postId}/insights`,
//       {
//         params: {
//           metric: "like_count,comment_count,share_count,impressions",
//           access_token: accessToken
//         }
//       }
//     );

//     const data = res.data?.data || [];

//     return {
//       likes: data[0]?.values?.[0]?.value || 0,
//       comments: data[1]?.values?.[0]?.value || 0,
//       shares: data[2]?.values?.[0]?.value || 0,
//       views: data[3]?.values?.[0]?.value || 0
//     };

//   } catch (err) {
//     console.log("Meta Insights Error:", err.message);

//     return { likes: 0, comments: 0, shares: 0, views: 0 };
//   }
// };



// // ================= YOUTUBE =================
// exports.fetchYouTubeInsights = async (apiKey, videoId) => {
//   try {
//     const res = await axios.get(
//       `https://www.googleapis.com/youtube/v3/videos`,
//       {
//         params: {
//           part: "statistics",
//           id: videoId,
//           key: apiKey
//         }
//       }
//     );

//     const stats = res.data?.items?.[0]?.statistics;

//     return {
//       likes: Number(stats?.likeCount || 0),
//       comments: Number(stats?.commentCount || 0),
//       shares: 0, // YouTube doesn't provide shares directly
//       views: Number(stats?.viewCount || 0)
//     };

//   } catch (err) {
//     console.log("YouTube Error:", err.message);

//     return { likes: 0, comments: 0, shares: 0, views: 0 };
//   }
// };



// // ================= TWITTER / X =================
// exports.fetchTwitterInsights = async (accessToken, tweetId) => {
//   try {
//     const res = await axios.get(
//       `https://api.twitter.com/2/tweets/${tweetId}`,
//       {
//         params: {
//           "tweet.fields": "public_metrics"
//         },
//         headers: {
//           Authorization: `Bearer ${accessToken}`
//         }
//       }
//     );

//     const metrics = res.data?.data?.public_metrics;

//     return {
//       likes: metrics?.like_count || 0,
//       comments: metrics?.reply_count || 0,
//       shares: metrics?.retweet_count || 0,
//       views: metrics?.impression_count || 0
//     };

//   } catch (err) {
//     console.log("Twitter Error:", err.message);

//     return { likes: 0, comments: 0, shares: 0, views: 0 };
//   }
// };

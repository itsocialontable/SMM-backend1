// ==========================================
// FILE: src/controllers/posts/analytics.controller.js
// FIXED v18: req.user._id istemaal ho raha tha jo hamesha undefined
//   hota hai (auth middleware sirf req.user.id set karta hai).
//   Isse $match khaali ({}) ban jaata tha aur analytics SAARE users
//   ke posts ka combined data dikhata tha — ek SMM ko doosri agency
//   ka data bhi mix hoke dikh sakta tha. Ab req.user.id ko sahi
//   ObjectId me cast karke match kiya jaata hai (raw aggregate
//   pipeline me Mongoose auto-cast nahi karta, explicit cast zaroori
//   hai).
// UPDATED v20: Optional ?clientId= query param — diya jaaye to sirf
//   usi client ke posts ka overview aata hai, aur response me
//   "client": { id, name, companyName } bhi milta hai taaki UI ko
//   pata chale ye kis client ka data hai. clientId na diya jaaye to
//   pehle jaisa hi — SMM/agency ke SAARE clients ka combined data.
// UPDATED v21: analytics block me ab totalReach, totalImpressions,
//   totalEngagement aur totalProfileViews bhi milte hain — sab REAL
//   data se (Post.reach/impressions jo analyticsSync.service.js real
//   platform APIs se sync karta hai, aur SocialAccount.profileViews
//   jo connected account ki khud ki insights se aata hai). Koi bhi
//   value hardcoded/static nahi — account connect na ho ya insights
//   permission na mile to genuinely 0 aayega, fake number kabhi nahi.
//   - totalEngagement standard formula se compute hota hai (on the
//     fly, DB me alag se store nahi kiya — hamesha likes+comments+
//     shares ke current totals ke sync me rehta hai):
//       totalEngagement = totalLikes + totalComments + totalShares
// ==========================================

const mongoose = require("mongoose");
const Post          = require("../../models/post.model");
const User2          = require("../../models/user2.model");
const SocialAccount  = require("../../models/socialAccount.model");
const { validateClientForSmm } = require("../../utils/validateClientForSmm.util");

exports.getOverview = async (req, res) => {
  try {

    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const { clientId } = req.query;

    // ================= OPTIONAL CLIENT FILTER =================
    let clientInfo = null;
    const baseFilter = { user: userId };

    if (clientId) {
      // Ownership verify karo — role ke hisaab se check alag hai
      if (req.user.role === "SMM") {
        const check = await validateClientForSmm(userId, clientId);
        if (!check.valid) {
          return res.status(400).json({ success: false, msg: check.reason });
        }
        clientInfo = check.client;
      } else {
        // Admin/Agency — client isi agency ka hona chahiye
        const client = await User2.findOne({ _id: clientId, agencyId: userId, role: "Client" })
          .select("name email companyName").lean();
        if (!client) {
          return res.status(400).json({ success: false, msg: "Client not found or not part of your agency" });
        }
        clientInfo = client;
      }
      baseFilter.client = clientId;
    }

    // ================= COUNTS =================
    const totalPosts = await Post.countDocuments({
      ...baseFilter
    });

    const draftPosts = await Post.countDocuments({
      ...baseFilter,
      status: "draft"
    });

    const queuedPosts = await Post.countDocuments({
      ...baseFilter,
      status: "queued"
    });

    const scheduledPosts = await Post.countDocuments({
      ...baseFilter,
      status: "scheduled"
    });

    const publishedPosts = await Post.countDocuments({
      ...baseFilter,
      status: "published"
    });

    // ================= ANALYTICS =================
    const matchStage = { user: userObjectId };
    if (clientId) matchStage.client = new mongoose.Types.ObjectId(clientId);

    const analytics = await Post.aggregate([
      {
        $match: matchStage
      },

      {
        $group: {
          _id: null,

          totalLikes: {
            $sum: "$likes"
          },

          totalComments: {
            $sum: "$comments"
          },

          totalShares: {
            $sum: "$shares"
          },

          totalViews: {
            $sum: "$views"
          },

          // v21: real reach/impressions totals (dekho post.model.js
          // + analyticsSync.service.js — real platform API data hai)
          totalReach: {
            $sum: "$reach"
          },

          totalImpressions: {
            $sum: "$impressions"
          }
        }
      }
    ]);

    const totals = analytics[0] || {
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalViews: 0,
      totalReach: 0,
      totalImpressions: 0
    };
    delete totals._id; // aggregate group ka default _id field, response me nahi chahiye

    // v21: Engagement ek standard derived metric hai — kisi field me
    // alag se store nahi karte (taaki likes/comments/shares update hone
    // par turant sync me rahe), yahin compute kar dete hain.
    const totalEngagement = (totals.totalLikes || 0) + (totals.totalComments || 0) + (totals.totalShares || 0);

    // ================= PROFILE VIEWS (account-level, real) =================
    // Ye post-level metric nahi hai — connected account (Facebook Page /
    // Instagram Business) ki khud ki insights hoti hai, isliye SocialAccount
    // collection se aata hai, Post collection se nahi.
    // NOTE: raw aggregate pipeline me Mongoose auto-cast nahi karta
    // (jaisa upar $match: { user: userObjectId } me bhi kiya gaya hai),
    // isliye yahan bhi explicit ObjectId cast zaroori hai.
    const accountFilter = { user: userObjectId, isActive: true };
    if (clientId) accountFilter.client = new mongoose.Types.ObjectId(clientId);

    const accountTotals = await SocialAccount.aggregate([
      { $match: accountFilter },
      {
        $group: {
          _id: null,
          totalProfileViews: { $sum: "$profileViews" }
        }
      }
    ]);

    const totalProfileViews = accountTotals[0]?.totalProfileViews || 0;

    // ================= PLATFORM-WISE BREAKDOWN =================
    // v20: har platform (facebook/instagram/youtube/etc.) ka apna
    // alag likes/comments/shares/views — results[] array unwind karke
    // per-platform analytics sub-object se sum kiya jaata hai.
    const platformMatchStage = { user: userObjectId, status: "published" };
    if (clientId) platformMatchStage.client = new mongoose.Types.ObjectId(clientId);

    const platformBreakdown = await Post.aggregate([
      {
        $match: platformMatchStage
      },
      { $unwind: "$results" },
      {
        $match: { "results.status": "success" }
      },
      {
        $group: {
          _id: "$results.platform",
          likes:       { $sum: { $ifNull: ["$results.analytics.likes", 0] } },
          comments:    { $sum: { $ifNull: ["$results.analytics.comments", 0] } },
          shares:      { $sum: { $ifNull: ["$results.analytics.shares", 0] } },
          views:       { $sum: { $ifNull: ["$results.analytics.views", 0] } },
          // v21: reach/impressions bhi per-platform breakdown me
          reach:       { $sum: { $ifNull: ["$results.analytics.reach", 0] } },
          impressions: { $sum: { $ifNull: ["$results.analytics.impressions", 0] } },
          posts:       { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          platform: "$_id",
          likes: 1, comments: 1, shares: 1, views: 1, reach: 1, impressions: 1, posts: 1
        }
      },
      { $sort: { platform: 1 } }
    ]);

    // v21: profile views bhi platform-wise (Facebook/Instagram) — same
    // filter jo accountTotals ke liye use hua, bas group platform pe hai
    const profileViewsByPlatform = await SocialAccount.aggregate([
      { $match: accountFilter },
      {
        $group: {
          _id: "$platform",
          profileViews: { $sum: "$profileViews" },
          reach:        { $sum: "$accountReach" }
        }
      },
      { $project: { _id: 0, platform: "$_id", profileViews: 1, reach: 1 } },
      { $sort: { platform: 1 } }
    ]);

    return res.status(200).json({
      success: true,

      data: {

        // v20: clientId diya gaya tha to yahan us client ka naam/info —
        // nahi diya to null (matlab "saare clients ka combined data")
        client: clientInfo
          ? { id: clientInfo._id, name: clientInfo.name, companyName: clientInfo.companyName || "" }
          : null,

        posts: {
          totalPosts,
          draftPosts,
          queuedPosts,
          scheduledPosts,
          publishedPosts
        },

        analytics: {
          ...totals,
          // v21: engagement (likes+comments+shares) + account-level
          // profile views — dono dynamic/real, dekho file header note
          totalEngagement,
          totalProfileViews,
          byPlatform: platformBreakdown,
          profileViewsByPlatform
        }
      }
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      msg: err.message
    });
  }
};

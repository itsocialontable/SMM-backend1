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
// ==========================================

const mongoose = require("mongoose");
const Post = require("../../models/post.model");

exports.getOverview = async (req, res) => {
  try {

    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // ================= COUNTS =================
    const totalPosts = await Post.countDocuments({
      user: userId
    });

    const draftPosts = await Post.countDocuments({
      user: userId,
      status: "draft"
    });

    const queuedPosts = await Post.countDocuments({
      user: userId,
      status: "queued"
    });

    const scheduledPosts = await Post.countDocuments({
      user: userId,
      status: "scheduled"
    });

    const publishedPosts = await Post.countDocuments({
      user: userId,
      status: "published"
    });

    // ================= ANALYTICS =================
    const analytics = await Post.aggregate([
      {
        $match: {
          user: userObjectId
        }
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
          }
        }
      }
    ]);

    const totals = analytics[0] || {
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalViews: 0
    };

    // ================= PLATFORM-WISE BREAKDOWN =================
    // v20: har platform (facebook/instagram/youtube/etc.) ka apna
    // alag likes/comments/shares/views — results[] array unwind karke
    // per-platform analytics sub-object se sum kiya jaata hai.
    const platformBreakdown = await Post.aggregate([
      {
        $match: {
          user: userObjectId,
          status: "published"
        }
      },
      { $unwind: "$results" },
      {
        $match: { "results.status": "success" }
      },
      {
        $group: {
          _id: "$results.platform",
          likes:    { $sum: { $ifNull: ["$results.analytics.likes", 0] } },
          comments: { $sum: { $ifNull: ["$results.analytics.comments", 0] } },
          shares:   { $sum: { $ifNull: ["$results.analytics.shares", 0] } },
          views:    { $sum: { $ifNull: ["$results.analytics.views", 0] } },
          posts:    { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          platform: "$_id",
          likes: 1, comments: 1, shares: 1, views: 1, posts: 1
        }
      },
      { $sort: { platform: 1 } }
    ]);

    return res.status(200).json({
      success: true,

      data: {

        posts: {
          totalPosts,
          draftPosts,
          queuedPosts,
          scheduledPosts,
          publishedPosts
        },

        analytics: {
          ...totals,
          byPlatform: platformBreakdown
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

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

        analytics: totals
      }
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      msg: err.message
    });
  }
};

// ==========================================
// FILE: src/controllers/posts/publish.controller.js
// FIXED v18: Post model aur postQueue ka require missing tha — isliye
// ye route call karte hi "Post is not defined" crash hota tha. Fix kar diya.
// ==========================================

const Post      = require("../../models/post.model");
const postQueue  = require("../../queues/post.queue");

exports.publishPost = async (req, res) => {
  try {

    const postId = req.params.id;

    const post = await Post.findOne({
      _id: postId,
      user: req.user.id
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        msg: "Post not found"
      });
    }

    // 🔥 prevent duplicate publish
    if (
      ["queued", "scheduled", "published"].includes(post.status)
    ) {
      return res.status(400).json({
        success: false,
        msg: `Post already ${post.status}`
      });
    }

    // 🔥 v18: client hona zaroori hai — SMM apne liye publish nahi karta
    if (!post.client) {
      return res.status(400).json({
        success: false,
        msg: "This post has no client linked — cannot publish."
      });
    }

    // 🔥 empty validation
    if (!post.content && !post.media?.length) {
      return res.status(400).json({
        success: false,
        msg: "Cannot publish empty draft"
      });
    }

    // 🔥 v19 FIX: platforms check missing tha yahan (publishDraft me
    // hai) — isliye empty-platforms wala post yahan se queue ho ke
    // "published" mark ho sakta tha bina kahin bhi real publish kiye.
    if (!post.platforms?.length) {
      return res.status(400).json({
        success: false,
        msg: "Cannot publish post — no platforms selected"
      });
    }

    let delay = 0;

    if (post.scheduleAt) {

      const scheduleDate = new Date(post.scheduleAt);

      delay = Math.max(scheduleDate - new Date(), 0);

      post.status = "scheduled";

    } else {

      post.status = "queued";
    }

    await post.save();

    // 🔥 add queue
    await postQueue.add(
      "publish-post",
      {
        postId: post._id
      },
      {
        delay
      }
    );

    return res.status(200).json({
      success: true,
      msg: "Post sent to queue successfully",
      data: post
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      msg: err.message
    });
  }
};
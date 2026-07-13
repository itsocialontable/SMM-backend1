const Post = require("../../models/post.model");

// TAG SUGGESTION API
exports.searchTags = async (req, res) => {
  try {
    // 1. safe query + trim + remove #
    let query = (req.query.query || "")
      .trim()
      .replace("#", "");

    // 2. empty check
    if (!query) {
      return res.json({
        success: true,
        data: []
      });
    }

    // 3. search distinct tags from posts
    const tags = await Post.distinct("tags", {
      tags: {
        $regex: query,
        $options: "i"
      }
    });

    return res.json({
      success: true,
      data: tags
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: err.message
    });
  }
};
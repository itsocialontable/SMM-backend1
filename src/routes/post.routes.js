// ==========================================
// FILE: src/routes/post.routes.js
// UPDATED v16: checkSubscription + trial post limit added
// ==========================================

const express = require("express");
const router  = express.Router();

const { createPost, getQueuedPosts, getPublishedPosts } = require("../controllers/posts/post.controller");
const { publishPost }                                    = require("../controllers/posts/publish.controller");
const { saveDraft, getDrafts, updateDraft, deleteDraft, publishDraft } = require("../controllers/posts/draft.controller");
const { getOverview }                                    = require("../controllers/posts/analytics.controller");
const { searchTags }                                     = require("../controllers/tags/tag.controller");

const auth             = require("../middleware/auth.middleware");
const role             = require("../middleware/role.middleware");
const upload           = require("../middleware/upload.middleware");
const checkUserActive  = require("../middleware/checkUserActive.middleware");
const { checkSubscription, checkTrialPostLimit } = require("../middleware/subscription.middleware");

// Base: login + active + SMM role + subscription check
router.use(auth, checkUserActive, role(["SMM"]), checkSubscription);

// Create post: also check trial post limit
router.post("/create", checkTrialPostLimit, upload.array("media", 10), createPost);

router.get("/queued",       getQueuedPosts);
router.post("/draft",       checkTrialPostLimit, upload.array("media", 10), saveDraft);
router.get("/drafts",       getDrafts);
router.put("/draft/:id",    upload.array("media", 10), updateDraft);
router.delete("/draft/:id", deleteDraft);
router.put("/draft/:id/publish", publishDraft);  // Draft ko publish/schedule karo
router.put("/publish/:id",  publishPost);
router.get("/overview",     getOverview);
router.get("/published",    getPublishedPosts);
router.get("/search-tags",  searchTags);

module.exports = router;

// ==========================================
// FILE: src/middleware/subscription.middleware.js
// UPDATED v19: Testing-mode bypass hata diya — production checks ab
//   live hain. Trial limits: clients 5, team members 5, posts 20.
// ==========================================

const Agency = require("../models/agency.model");
const User2  = require("../models/user2.model");
const Post   = require("../models/post.model");

// ──────────────────────────────────────────────────────────────────
// HELPER: Get agency from request
// req.user.role === "admin" → req.user.id IS the agency id
// req.user.role === "SMM" / "Client" etc → look up via agencyId
// ──────────────────────────────────────────────────────────────────
const getAgency = async (req) => {
  if (!req.user) return null;

  if (req.user.role === "admin") {
    return Agency.findById(req.user.id);
  }

  // For sub-users (SMM, GD, Client) look up their agencyId
  const user = await User2.findById(req.user.id).select("agencyId").lean();
  if (!user?.agencyId) return null;

  return Agency.findById(user.agencyId);
};

// ──────────────────────────────────────────────────────────────────
// CHECK SUBSCRIPTION STATUS
// Blocks access if agency trial has expired AND no active paid plan
// ──────────────────────────────────────────────────────────────────
exports.checkSubscription = async (req, res, next) => {
  try {
    const agency = await getAgency(req);

    if (!agency) {
      // No agency context (e.g. superadmin) — allow through
      return next();
    }

    const now = new Date();

    // ── TRIAL ──────────────────────────────────────────────────────
    if (agency.subscriptionStatus === "trial") {
      if (agency.trialEndDate && now > agency.trialEndDate) {
        // Trial expired — update status in DB
        agency.subscriptionStatus = "expired";
        await agency.save();

        return res.status(402).json({
          success: false,
          code:    "TRIAL_EXPIRED",
          msg:     "Your 3-day trial has expired. Please upgrade to a paid plan to continue.",
          data: {
            trialEndDate: agency.trialEndDate,
            subscriptionStatus: "expired"
          }
        });
      }
      // Trial still active
      return next();
    }

    // ── ACTIVE PAID PLAN ────────────────────────────────────────────
    if (agency.subscriptionStatus === "active") {
      if (agency.subscriptionExpiry && now > agency.subscriptionExpiry) {
        agency.subscriptionStatus = "expired";
        await agency.save();

        return res.status(402).json({
          success: false,
          code:    "SUBSCRIPTION_EXPIRED",
          msg:     "Your subscription has expired. Please renew to continue.",
          data: {
            subscriptionExpiry: agency.subscriptionExpiry,
            subscriptionStatus: "expired"
          }
        });
      }
      return next();
    }

    // ── EXPIRED ─────────────────────────────────────────────────────
    if (agency.subscriptionStatus === "expired") {
      return res.status(402).json({
        success: false,
        code:    "SUBSCRIPTION_EXPIRED",
        msg:     "Your subscription has expired. Please contact support or upgrade your plan.",
        data: { subscriptionStatus: "expired" }
      });
    }

    // Unknown status — allow through (fail-open for safety)
    return next();

  } catch (err) {
    console.error("SUBSCRIPTION MIDDLEWARE ERROR =>", err);
    return res.status(500).json({ success: false, msg: "Subscription check failed" });
  }
};

// ──────────────────────────────────────────────────────────────────
// CHECK TRIAL LIMITS
// Trial plan: max 5 clients, 5 team members, 20 posts
// ──────────────────────────────────────────────────────────────────
const TRIAL_LIMITS = {
  clients:     10,
  teamMembers: 5,
  posts:       20
};

exports.checkTrialClientLimit = async (req, res, next) => {
  try {
    const agency = await getAgency(req);
    if (!agency || agency.subscriptionStatus !== "trial") return next();

    const count = await User2.countDocuments({
      agencyId: agency._id,
      role:     "Client"
    });

    if (count >= TRIAL_LIMITS.clients) {
      return res.status(403).json({
        success: false,
        code:    "TRIAL_LIMIT_REACHED",
        msg:     `Trial plan allows maximum ${TRIAL_LIMITS.clients} clients. Please upgrade to add more.`,
        data:    { limit: TRIAL_LIMITS.clients, current: count }
      });
    }

    return next();
  } catch (err) {
    console.error("TRIAL CLIENT LIMIT ERROR =>", err);
    return res.status(500).json({ success: false, msg: "Limit check failed" });
  }
};

exports.checkTrialTeamMemberLimit = async (req, res, next) => {
  try {
    const agency = await getAgency(req);
    if (!agency || agency.subscriptionStatus !== "trial") return next();

    const count = await User2.countDocuments({
      agencyId: agency._id,
      role:     { $in: ["SMM", "Graphic Designer"] }
    });

    if (count >= TRIAL_LIMITS.teamMembers) {
      return res.status(403).json({
        success: false,
        code:    "TRIAL_LIMIT_REACHED",
        msg:     `Trial plan allows maximum ${TRIAL_LIMITS.teamMembers} team members. Please upgrade to add more.`,
        data:    { limit: TRIAL_LIMITS.teamMembers, current: count }
      });
    }

    return next();
  } catch (err) {
    console.error("TRIAL TEAM MEMBER LIMIT ERROR =>", err);
    return res.status(500).json({ success: false, msg: "Limit check failed" });
  }
};

exports.checkTrialPostLimit = async (req, res, next) => {
  try {
    const agency = await getAgency(req);
    if (!agency || agency.subscriptionStatus !== "trial") return next();

    // Count total posts by all users under this agency
    const agencyUserIds = await User2.find({ agencyId: agency._id })
      .select("_id").lean();
    const ids = agencyUserIds.map(u => u._id);

    // Also include the admin themselves (req.user.id if admin)
    if (req.user.role === "admin") ids.push(agency._id);

    const count = await Post.countDocuments({ user: { $in: ids } });

    if (count >= TRIAL_LIMITS.posts) {
      return res.status(403).json({
        success: false,
        code:    "TRIAL_LIMIT_REACHED",
        msg:     `Trial plan allows maximum ${TRIAL_LIMITS.posts} posts. Please upgrade to create more.`,
        data:    { limit: TRIAL_LIMITS.posts, current: count }
      });
    }

    return next();
  } catch (err) {
    console.error("TRIAL POST LIMIT ERROR =>", err);
    return res.status(500).json({ success: false, msg: "Limit check failed" });
  }
};

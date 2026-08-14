// ==========================================
// FILE: src/controllers/admin/analytics.controller.js
// NEW (ADD-ON): Admin (agency) level analytics.
//   - getAdminAnalyticsOverview: agency ke SAARE SMMs + clients ka
//     combined post analytics (likes/comments/shares/views/reach/
//     impressions/engagement/profileViews) — sab real data
//     (analyticsSync.service.js jo already sync karta hai), + ek
//     weekly/monthly/yearly TREND array (chart ke liye) taaki admin
//     dekh sake performance time ke saath kaise badal rahi hai.
//   - getAdminRevenueOverview: Invoice collection se real revenue —
//     totalRevenue (sirf "Paid" invoices), totalInvoiced, totalPending,
//     totalOverdue + status-wise breakdown + weekly/monthly/yearly
//     revenue trend.
// Koi existing controller/route/model isse touch nahi hua — ye bilkul
// naya, alag module hai (jaisa invoice.controller.js pehle add hua tha).
// ==========================================

const mongoose = require("mongoose");
const Post          = require("../../models/post.model");
const Invoice        = require("../../models/invoice.model");
const SocialAccount  = require("../../models/socialAccount.model");
const User2           = require("../../models/user2.model");

// Sirf ye 3 periods support karte hain — kuch aur diya jaaye to
// silently "monthly" default use hota hai (galat query se crash na ho)
const PERIOD_FORMATS = {
  weekly:  "%G-W%V",  // ISO week-year, e.g. "2026-W33"
  monthly: "%Y-%m",   // e.g. "2026-08"
  yearly:  "%Y"        // e.g. "2026"
};

function resolvePeriod(period) {
  return PERIOD_FORMATS[period] ? period : "monthly";
}


// =====================================
// GET /api/admin/analytics/overview
// Query: ?period=weekly|monthly|yearly (default monthly)
//        &clientId=  (optional — sirf ek client ka data)
//        &smmId=     (optional — sirf ek SMM ka data)
// Agency-wide REAL post analytics + trend (weekly/monthly/yearly)
// =====================================
exports.getAdminAnalyticsOverview = async (req, res) => {
  try {
    const agencyId = req.user.id; // admin khud agency hai
    const period = resolvePeriod(req.query.period);
    const dateFormat = PERIOD_FORMATS[period];
    const { clientId, smmId } = req.query;

    // Agency ke saare SMM users — Post.user hamesha SMM ki User2 _id
    // hoti hai, isliye pehle unki IDs nikalni padti hain.
    const smmFilter = { agencyId, role: "SMM" };
    if (smmId) smmFilter._id = smmId;
    const smmUsers = await User2.find(smmFilter).select("_id").lean();
    const smmIds = smmUsers.map((u) => u._id);

    // Agency ka abhi tak koi SMM hi nahi — empty response, error nahi
    if (!smmIds.length) {
      return res.status(200).json({
        success: true,
        msg: "Admin analytics overview fetched",
        data: {
          period,
          totals: {
            totalLikes: 0, totalComments: 0, totalShares: 0, totalViews: 0,
            totalReach: 0, totalImpressions: 0, totalEngagement: 0, totalProfileViews: 0
          },
          trend: [],
          byPlatform: []
        }
      });
    }

    const matchStage = { user: { $in: smmIds } };
    if (clientId) matchStage.client = new mongoose.Types.ObjectId(clientId);

    // ================= TOTALS (likes/comments/shares/views/reach/impressions) =================
    const totalsAgg = await Post.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalLikes:       { $sum: "$likes" },
          totalComments:    { $sum: "$comments" },
          totalShares:      { $sum: "$shares" },
          totalViews:        { $sum: "$views" },
          totalReach:        { $sum: "$reach" },
          totalImpressions:  { $sum: "$impressions" }
        }
      }
    ]);

    const totals = totalsAgg[0] || {
      totalLikes: 0, totalComments: 0, totalShares: 0,
      totalViews: 0, totalReach: 0, totalImpressions: 0
    };
    delete totals._id;
    const totalEngagement = (totals.totalLikes || 0) + (totals.totalComments || 0) + (totals.totalShares || 0);

    // ================= PROFILE VIEWS (account-level, agency-wide) =================
    const accountFilter = { user: { $in: smmIds }, isActive: true };
    if (clientId) accountFilter.client = new mongoose.Types.ObjectId(clientId);

    const accountAgg = await SocialAccount.aggregate([
      { $match: accountFilter },
      { $group: { _id: null, totalProfileViews: { $sum: "$profileViews" } } }
    ]);
    const totalProfileViews = accountAgg[0]?.totalProfileViews || 0;

    // ================= WEEKLY/MONTHLY/YEARLY TREND =================
    // Sirf PUBLISHED posts ka trend banta hai — draft/queued posts ka
    // analytics data hota hi nahi (abhi publish nahi hue).
    const trendMatch = { ...matchStage, status: "published" };

    const trend = await Post.aggregate([
      { $match: trendMatch },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: { $ifNull: ["$publishedAt", "$createdAt"] }
            }
          },
          likes:       { $sum: "$likes" },
          comments:    { $sum: "$comments" },
          shares:      { $sum: "$shares" },
          views:       { $sum: "$views" },
          reach:       { $sum: "$reach" },
          impressions: { $sum: "$impressions" },
          posts:       { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          period: "$_id",
          likes: 1, comments: 1, shares: 1, views: 1, reach: 1, impressions: 1, posts: 1,
          engagement: { $add: ["$likes", "$comments", "$shares"] }
        }
      },
      { $sort: { period: 1 } }
    ]);

    // ================= PLATFORM-WISE BREAKDOWN (agency-wide) =================
    const byPlatform = await Post.aggregate([
      { $match: trendMatch },
      { $unwind: "$results" },
      { $match: { "results.status": "success" } },
      {
        $group: {
          _id: "$results.platform",
          likes:       { $sum: { $ifNull: ["$results.analytics.likes", 0] } },
          comments:    { $sum: { $ifNull: ["$results.analytics.comments", 0] } },
          shares:      { $sum: { $ifNull: ["$results.analytics.shares", 0] } },
          views:       { $sum: { $ifNull: ["$results.analytics.views", 0] } },
          reach:       { $sum: { $ifNull: ["$results.analytics.reach", 0] } },
          impressions: { $sum: { $ifNull: ["$results.analytics.impressions", 0] } },
          posts:       { $sum: 1 }
        }
      },
      { $project: { _id: 0, platform: "$_id", likes: 1, comments: 1, shares: 1, views: 1, reach: 1, impressions: 1, posts: 1 } },
      { $sort: { platform: 1 } }
    ]);

    return res.status(200).json({
      success: true,
      msg: "Admin analytics overview fetched",
      data: {
        period,          // konsa grouping use hua (weekly/monthly/yearly)
        totals: { ...totals, totalEngagement, totalProfileViews },
        trend,            // [{ period: "2026-08", likes, comments, shares, views, reach, impressions, posts, engagement }, ...]
        byPlatform
      }
    });

  } catch (error) {
    console.error("ADMIN ANALYTICS OVERVIEW ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET /api/admin/analytics/revenue
// Query: ?period=weekly|monthly|yearly (default monthly)
//        &status= (optional — Draft/Sent/Paid/Overdue/Cancelled, totals filter ke liye)
// Real revenue overview — Invoice collection se (koi hardcoded number nahi)
// =====================================
exports.getAdminRevenueOverview = async (req, res) => {
  try {
    const agencyId = req.user.id;
    const agencyObjectId = new mongoose.Types.ObjectId(agencyId);
    const period = resolvePeriod(req.query.period);
    const dateFormat = PERIOD_FORMATS[period];
    const { status } = req.query;

    const totalsFilter = { agencyId: agencyObjectId };
    if (status) totalsFilter.status = status;

    const [revenueAgg, statusBreakdown, trend] = await Promise.all([

      // ================= TOTALS =================
      // totalRevenue  = sirf "Paid" invoices ka amount — asal me collect
      //                 hua paisa (real revenue, koi estimate nahi)
      // totalInvoiced = "Cancelled" chhod ke saare invoices (raised amount)
      // totalPending  = "Sent" + "Overdue" (abhi tak collect nahi hua)
      // totalOverdue  = sirf "Overdue"
      Invoice.aggregate([
        { $match: totalsFilter },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: { $cond: [{ $eq: ["$status", "Paid"] }, "$totalAmount", 0] }
            },
            totalInvoiced: {
              $sum: { $cond: [{ $ne: ["$status", "Cancelled"] }, "$totalAmount", 0] }
            },
            totalPending: {
              $sum: { $cond: [{ $in: ["$status", ["Sent", "Overdue"]] }, "$totalAmount", 0] }
            },
            totalOverdue: {
              $sum: { $cond: [{ $eq: ["$status", "Overdue"] }, "$totalAmount", 0] }
            },
            invoiceCount: { $sum: 1 }
          }
        },
        { $project: { _id: 0, totalRevenue: 1, totalInvoiced: 1, totalPending: 1, totalOverdue: 1, invoiceCount: 1 } }
      ]),

      // ================= STATUS-WISE BREAKDOWN =================
      // (status query param se independent — hamesha saare statuses dikhte hain)
      Invoice.aggregate([
        { $match: { agencyId: agencyObjectId } },
        {
          $group: {
            _id: "$status",
            totalAmount: { $sum: "$totalAmount" },
            count: { $sum: 1 }
          }
        },
        { $project: { _id: 0, status: "$_id", totalAmount: 1, count: 1 } },
        { $sort: { status: 1 } }
      ]),

      // ================= WEEKLY/MONTHLY/YEARLY REVENUE TREND =================
      // Sirf "Paid" invoices ka trend — jo actually collect hua wahi
      // "revenue" hai, "Draft"/"Sent" invoices abhi revenue nahi hain.
      Invoice.aggregate([
        { $match: { agencyId: agencyObjectId, status: "Paid" } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: dateFormat,
                date: { $ifNull: ["$issueDate", "$createdAt"] }
              }
            },
            revenue:  { $sum: "$totalAmount" },
            invoices: { $sum: 1 }
          }
        },
        { $project: { _id: 0, period: "$_id", revenue: 1, invoices: 1 } },
        { $sort: { period: 1 } }
      ])
    ]);

    const totals = revenueAgg[0] || {
      totalRevenue: 0, totalInvoiced: 0, totalPending: 0, totalOverdue: 0, invoiceCount: 0
    };

    return res.status(200).json({
      success: true,
      msg: "Admin revenue overview fetched",
      data: {
        period,
        totals,           // { totalRevenue, totalInvoiced, totalPending, totalOverdue, invoiceCount }
        statusBreakdown,  // [{ status: "Paid", totalAmount, count }, ...]
        trend             // [{ period: "2026-08", revenue, invoices }, ...]
      }
    });

  } catch (error) {
    console.error("ADMIN REVENUE OVERVIEW ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// ==========================================
// FILE: src/controllers/admin/dashboard.controller.js
// FIXED v17: agencyId isolation — sirf apni agency ka data
// ==========================================

const User2         = require("../../models/user2.model");
const DesignProject = require("../../models/designProject.model");
const Post          = require("../../models/post.model");

exports.getAdminDashboard = async (req, res) => {
  try {
    const agencyId = req.user.id;   // 🔒 logged-in agency ki ID

    const today      = new Date();
    const todayStart = new Date(today); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(today); todayEnd.setHours(23,59,59,999);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalClients,
      totalSMMs,
      totalGDs,
      activeUsers,
      totalProjects,
      pendingProjects,
      inProgressProjects,
      completedProjects,
      overdueProjects,
      completedThisMonth,
      recentProjects,
      recentUsers
    ] = await Promise.all([
      // 🔒 har countDocuments mein agencyId filter
      User2.countDocuments({ agencyId, role: "Client" }),
      User2.countDocuments({ agencyId, role: "SMM" }),
      User2.countDocuments({ agencyId, role: "Graphic Designer" }),
      User2.countDocuments({ agencyId, isActive: true }),

      // Design projects — assignedBy sirf is agency ke SMMs honge
      // lekin safe rehne ke liye hum SMM IDs se filter karenge
      DesignProject.countDocuments({ agencyId }),
      DesignProject.countDocuments({ agencyId, status: "Pending" }),
      DesignProject.countDocuments({ agencyId, status: "In Progress" }),
      DesignProject.countDocuments({ agencyId, status: "Completed" }),
      DesignProject.countDocuments({
        agencyId,
        deadline: { $lt: today },
        status:   { $nin: ["Completed", "Cancelled"] }
      }),
      DesignProject.countDocuments({
        agencyId,
        status:    "Completed",
        updatedAt: { $gte: monthStart }
      }),

      // Recent 5 projects
      DesignProject.find({ agencyId })
        .populate("client",    "name companyName")
        .populate("designer",  "name")
        .populate("assignedBy","name")
        .select("title status priority deadline createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Recent 5 users — sirf is agency ke
      User2.find({ agencyId })
        .select("name email role isActive createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      msg: "Admin dashboard fetched successfully",
      data: {
        users: {
          totalClients,
          totalSMMs,
          totalGDs,
          totalUsers: totalClients + totalSMMs + totalGDs,
          activeUsers
        },
        projects: {
          totalProjects,
          pendingProjects,
          inProgressProjects,
          completedProjects,
          overdueProjects,
          completedThisMonth
        },
        recentProjects,
        recentUsers
      }
    });

  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

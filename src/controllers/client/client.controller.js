// FILE: src/controllers/client/client.controller.js
// Option B — Client Dashboard: design review + content calendar + profile

const DesignProject  = require("../../models/designProject.model");
const DesignFile     = require("../../models/designFile.model");
const Post           = require("../../models/post.model");
const User2          = require("../../models/user2.model");
const sendNotification = require("../../utils/sendNotification.utils");


// ── 1. CLIENT DASHBOARD ───────────────────────────────────────────────────────
// GET /api/client/dashboard
exports.getClientDashboard = async (req, res) => {
  try {
    const clientId = req.user.id;

    const [
      totalProjects,
      pendingReview,
      approvedProjects,
      completedProjects,
      recentProjects
    ] = await Promise.all([
      DesignProject.countDocuments({ client: clientId }),
      DesignProject.countDocuments({ client: clientId, status: "Client Review" }),
      DesignProject.countDocuments({ client: clientId, "clientApproval.action": "approve" }),
      DesignProject.countDocuments({ client: clientId, status: "Completed" }),
      DesignProject.find({ client: clientId })
        .populate("assignedBy", "name")
        .populate("designer",   "name")
        .select("title status priority deadline clientApproval sharedWithClient createdAt")
        .sort({ createdAt: -1 }).limit(5).lean()
    ]);

    return res.status(200).json({
      success: true,
      msg: "Client dashboard fetched",
      data: {
        stats: { totalProjects, pendingReview, approvedProjects, completedProjects },
        recentProjects
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// ── 2. CLIENT KE SAARE DESIGN PROJECTS ───────────────────────────────────────
// GET /api/client/design-projects
// ?status=Client Review  ?page=1&limit=10
exports.getMyProjects = async (req, res) => {
  try {
    const clientId = req.user.id;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = { client: clientId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) filter.title  = { $regex: req.query.search, $options: "i" };

    const [projects, total] = await Promise.all([
      DesignProject.find(filter)
        .populate("assignedBy", "name email")
        .populate("designer",   "name email specialization")
        .select("-comments -statusHistory")
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      DesignProject.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: { projects, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 3. SINGLE PROJECT DETAIL (with design files) ─────────────────────────────
// GET /api/client/design-projects/:id
exports.getProjectDetail = async (req, res) => {
  try {
    const project = await DesignProject.findOne({ _id: req.params.id, client: req.user.id })
      .populate("assignedBy", "name email")
      .populate("designer",   "name email specialization profileImage")
      .lean();

    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    // Sirf Final files dikhao client ko (Draft nahi)
    const files = await DesignFile.find({ project: project._id, fileType: "Final" })
      .sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      data: {
        project,
        designFiles: files,
        revisionInfo: {
          used:      project.revisionCount,
          limit:     project.revisionLimit,
          remaining: project.revisionLimit - project.revisionCount
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 4. CLIENT DESIGN APPROVE / REJECT (Option B core) ───────────────────────
// PATCH /api/client/design-projects/:id/review
// Body: { action: "approve" | "reject", feedback: "..." }
exports.reviewDesign = async (req, res) => {
  try {
    const { action, feedback } = req.body;

    if (!action || !["approve","reject"].includes(action)) {
      return res.status(400).json({ success: false, msg: "action zaroori hai: 'approve' ya 'reject'" });
    }

    const project = await DesignProject.findOne({ _id: req.params.id, client: req.user.id });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    // Sirf "Client Review" status pe review ho sakta hai
    if (project.status !== "Client Review") {
      return res.status(400).json({
        success: false,
        msg: `Project status '${project.status}' hai — sirf 'Client Review' status wale projects review kiye ja sakte hain`
      });
    }

    // Client approval record karo
    project.clientApproval = { action, feedback: feedback || "", reviewedAt: new Date() };

    const oldStatus = project.status;
    // Approve → Completed, Reject → Revision
    project.status = action === "approve" ? "Completed" : "Revision";
    if (action === "approve") project.progressPercentage = 100;
    project.statusHistory.push({ oldStatus, newStatus: project.status, changedBy: req.user.id, changedAt: new Date() });
    await project.save();

    // SMM ko notification + email
    await sendNotification({
      userId:    project.assignedBy,
      type:      action === "approve" ? "SUCCESS" : "WARNING",
      event:     action === "approve" ? "client_approved" : "client_rejected",
      title:     action === "approve"
        ? `Client ne Approve Kiya — "${project.title}"`
        : `Client ne Reject Kiya — "${project.title}"`,
      message:   action === "approve"
        ? `Client ne design approve kar diya! Project complete ho gaya.`
        : `Client feedback: "${feedback || 'No feedback provided'}". GD ko revision bhejo.`,
      projectId: project._id,
      templateData: {
        projectTitle: project.title,
        feedback:     feedback || "",
        isGD: false
      }
    });

    // GD ko bhi notification + email — approve aur reject dono pe
    await sendNotification({
      userId:    project.designer,
      type:      action === "approve" ? "SUCCESS" : "WARNING",
      event:     action === "approve" ? "client_approved" : "client_rejected",
      title:     action === "approve"
        ? "Your Design is Approved!"
        : "Design Rejected — Revision Required",
      message:   action === "approve"
        ? `"${project.title}" — client ne approve kar diya! Great work!`
        : `"${project.title}" — feedback: "${feedback || 'Changes required'}". Please revise.`,
      projectId: project._id,
      templateData: {
        projectTitle: project.title,
        feedback:     feedback || "",
        isGD: true
      }
    });

    return res.status(200).json({
      success: true,
      msg: action === "approve"
        ? "Design approve kar diya — SMM ko notify kar diya gaya"
        : "Design reject kiya — feedback SMM ko bhej diya gaya",
      data: {
        projectId:      project._id,
        title:          project.title,
        clientApproval: project.clientApproval,
        status:         project.status
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 5. CONTENT CALENDAR — Scheduled + Published Posts ───────────────────────
// GET /api/client/content-calendar
// ?month=2025-09  ?platform=instagram  ?status=scheduled
exports.getContentCalendar = async (req, res) => {
  try {
    const clientId = req.user.id;

    // Client ke projects ke SMM IDs nikalo
    const clientProjects = await DesignProject.find({ client: clientId })
      .select("assignedBy").lean();
    const smmIds = [...new Set(clientProjects.map(p => p.assignedBy?.toString()).filter(Boolean))];

    if (smmIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: { posts: [], scheduledPosts: [], publishedPosts: [] }
      });
    }

    // Filter build karo
    const filter = { user: { $in: smmIds } };
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.platform) filter.platforms = { $in: [req.query.platform] };

    // Month filter
    if (req.query.month) {
      const [year, month] = req.query.month.split("-").map(Number);
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 0, 23, 59, 59);
      filter.$or  = [
        { scheduleAt: { $gte: start, $lte: end } },
        { publishedAt: { $gte: start, $lte: end } }
      ];
    }

    const posts = await Post.find(filter)
      .select("content platforms status scheduleAt publishedAt media tags likes comments shares views createdAt")
      .sort({ scheduleAt: 1, publishedAt: -1 })
      .lean();

    const scheduledPosts = posts.filter(p => p.status === "scheduled");
    const publishedPosts = posts.filter(p => p.status === "published");

    return res.status(200).json({
      success: true,
      data: { posts, scheduledPosts, publishedPosts, total: posts.length }
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 6. CLIENT PROFILE ────────────────────────────────────────────────────────
// GET /api/client/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User2.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ success: false, msg: "User not found" });
    return res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// PUT /api/client/profile
exports.updateProfile = async (req, res) => {
  try {
    const PROTECTED = ["email","password","role","isActive","_id"];
    PROTECTED.forEach(f => delete req.body[f]);

    const user = await User2.findByIdAndUpdate(
      req.user.id, { $set: req.body }, { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, msg: "User not found" });
    return res.status(200).json({ success: true, msg: "Profile updated", data: { user } });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 7. CLIENT NOTIFICATIONS ───────────────────────────────────────────────────
// GET /api/client/notifications  — /api/notifications se milta julta
// Client apni notifications dekhe (project_sent_to_client, client_approved etc.)
// NOTE: /api/notifications already kaam karta hai — ye ek alias hai
exports.getNotifications = async (req, res) => {
  try {
    const Notification = require("../../models/notification.model");
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = { userId: req.user.id };
    if (req.query.unreadOnly === "true") filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user.id, isRead: false })
    ]);

    return res.status(200).json({
      success: true,
      data: { notifications, unreadCount, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};



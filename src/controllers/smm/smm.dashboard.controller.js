// FILE: src/controllers/smm/smm.dashboard.controller.js

const DesignProject    = require("../../models/designProject.model");
const User2            = require("../../models/user2.model");
const Post             = require("../../models/post.model");
const sendNotification = require("../../utils/sendNotification.utils");


// ── 1. SMM DASHBOARD ─────────────────────────────────────────────────────────
// GET /api/smm/dashboard
exports.getSmmDashboard = async (req, res) => {
  try {
    const smmId      = req.user.id;
    const today      = new Date();
    const todayStart = new Date(today); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(today); todayEnd.setHours(23,59,59,999);

    const [
      totalProjects,
      pendingProjects,
      inProgressProjects,
      smmReviewProjects,
      clientReviewProjects,
      revisionProjects,
      completedProjects,
      overdueProjects,
      dueTodayProjects,
      totalPosts,
      scheduledPosts,
      publishedPosts,
      recentProjects
    ] = await Promise.all([
      DesignProject.countDocuments({ assignedBy: smmId }),
      DesignProject.countDocuments({ assignedBy: smmId, status: "Pending" }),
      DesignProject.countDocuments({ assignedBy: smmId, status: "In Progress" }),
      DesignProject.countDocuments({ assignedBy: smmId, status: "SMM Review" }),
      DesignProject.countDocuments({ assignedBy: smmId, status: "Client Review" }),
      DesignProject.countDocuments({ assignedBy: smmId, status: "Revision" }),
      DesignProject.countDocuments({ assignedBy: smmId, status: "Completed" }),
      DesignProject.countDocuments({
        assignedBy: smmId,
        deadline:   { $lt: today },
        status:     { $nin: ["Completed","Cancelled"] }
      }),
      DesignProject.countDocuments({
        assignedBy: smmId,
        deadline:   { $gte: todayStart, $lte: todayEnd },
        status:     { $nin: ["Completed","Cancelled"] }
      }),
      Post.countDocuments({ user: smmId }),
      Post.countDocuments({ user: smmId, status: "scheduled" }),
      Post.countDocuments({ user: smmId, status: "published" }),
      DesignProject.find({ assignedBy: smmId })
        .populate("client",   "name companyName")
        .populate("designer", "name")
        .select("title status priority deadline revisionCount revisionLimit clientApproval createdAt")
        .sort({ createdAt: -1 }).limit(5).lean()
    ]);

    return res.status(200).json({
      success: true,
      msg: "SMM Dashboard fetched",
      data: {
        designStats: {
          totalProjects,
          pendingProjects,
          inProgressProjects,
          smmReviewProjects,
          clientReviewProjects,
          revisionProjects,
          completedProjects,
          overdueProjects,
          dueTodayProjects
        },
        postStats: { totalPosts, scheduledPosts, publishedPosts },
        recentProjects
      }
    });
  } catch (error) {
    console.error("SMM DASHBOARD ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 2. SMM DESIGN REVIEW ──────────────────────────────────────────────────────
// PATCH /api/smm/design-projects/:id/smm-review
// GD ne submit kiya → SMM yahan approve ya reject karta hai
// approve → "Client Review" + client ko notify
// reject  → "Revision"     + GD ko notify
// Body: { action: "approve" | "reject", note: "..." }
exports.smmReviewProject = async (req, res) => {
  try {
    const { action, note } = req.body;

    if (!action || !["approve","reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        msg: "action zaroori hai: 'approve' ya 'reject'"
      });
    }

    const project = await DesignProject.findOne({
      _id: req.params.id, assignedBy: req.user.id
    });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    // Sirf "SMM Review" status pe SMM review kar sakta hai
    if (project.status !== "SMM Review") {
      return res.status(400).json({
        success: false,
        msg: `Project status '${project.status}' hai — sirf 'SMM Review' status wale projects review kiye ja sakte hain`
      });
    }

    const oldStatus = project.status;

    if (action === "approve") {
      // ── SMM APPROVE → Client Review ────────────────────────────────────────
      project.status = "Client Review";
      project.statusHistory.push({
        oldStatus, newStatus: "Client Review",
        changedBy: req.user.id, changedAt: new Date()
      });
      await project.save();

      // Client ko notify karo — ab unke paas review ke liye aaya hai
      await sendNotification({
        userId:    project.client,
        type:      "INFO",
        event:     "design_sent_to_client",
        title:     "Aapka Design Review ke liye Ready Hai!",
        message:   `"${project.title}" ka design ready ho gaya hai. Please review karein aur approve ya reject karein.`,
        projectId: project._id,
        templateData: {
          projectTitle: project.title,
          note: note || ""
        }
      });

      // GD ko bhi batao ki SMM ne approve kar diya
      await sendNotification({
        userId:    project.designer,
        type:      "SUCCESS",
        event:     "smm_approved_design",
        title:     "SMM ne Design Approve Kiya",
        message:   `"${project.title}" — SMM ne approve kar diya! Ab client review karega.`,
        projectId: project._id,
        templateData: { projectTitle: project.title }
      });

      return res.status(200).json({
        success: true,
        msg: "Design approve ho gaya! Client ko review ke liye bhej diya.",
        data: { projectId: project._id, title: project.title, status: project.status }
      });

    } else {
      // ── SMM REJECT → Revision ──────────────────────────────────────────────
      project.revisionCount += 1;
      project.status = "Revision";
      project.statusHistory.push({
        oldStatus, newStatus: "Revision",
        changedBy: req.user.id, changedAt: new Date()
      });
      if (note) project.internalNotes = note;
      await project.save();

      // GD ko revision notify karo
      await sendNotification({
        userId:    project.designer,
        type:      "WARNING",
        event:     "smm_rejected_design",
        title:     "SMM ne Design Reject Kiya — Revision Karo",
        message:   `"${project.title}" — SMM ko changes chahiye: "${note || 'Koi note nahi diya'}". Please revise karo.`,
        projectId: project._id,
        templateData: {
          projectTitle:    project.title,
          revisionMessage: note || "",
          revisionCount:   project.revisionCount,
          revisionLimit:   project.revisionLimit
        }
      });

      return res.status(200).json({
        success: true,
        msg: "Design reject ho gaya. GD ko revision ke liye notify kar diya.",
        data: {
          projectId:     project._id,
          title:         project.title,
          status:        project.status,
          revisionCount: project.revisionCount
        }
      });
    }

  } catch (error) {
    console.error("SMM REVIEW ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

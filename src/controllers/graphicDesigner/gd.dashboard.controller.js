// ==========================================
// FILE: src/controllers/graphicDesigner/gd.dashboard.controller.js
// Functions: getDashboard, getProjects, getProjectDetails, updateProgress, getDeadlines
// ==========================================

const DesignProject = require("../../models/designProject.model");
const DesignFile    = require("../../models/designFile.model");
const Revision      = require("../../models/revision.model");


// =====================================
// 1. DASHBOARD SUMMARY CARDS
// GET /api/gd/dashboard
// =====================================

exports.getDashboard = async (req, res) => {
  try {
    const designerId = req.user.id;
    const today      = new Date();
    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);

    const [
      totalTasks,
      pendingTasks,
      inProgressTasks,
      revisionTasks,
      completedTasks,
      dueToday
    ] = await Promise.all([
      DesignProject.countDocuments({ designer: designerId }),
      DesignProject.countDocuments({ designer: designerId, status: "Pending" }),
      DesignProject.countDocuments({ designer: designerId, status: "In Progress" }),
      DesignProject.countDocuments({ designer: designerId, status: "Revision" }),
      DesignProject.countDocuments({ designer: designerId, status: "Completed" }),
      DesignProject.countDocuments({
        designer: designerId,
        deadline: { $gte: todayStart, $lte: todayEnd },
        status:   { $nin: ["Completed", "Cancelled"] }
      })
    ]);

    return res.status(200).json({
      success: true,
      msg:  "Dashboard fetched successfully",
      data: {
        totalTasks,
        pendingTasks,
        inProgressTasks,
        revisionTasks,
        completedTasks,
        dueToday
      }
    });

  } catch (error) {
    console.error("GD DASHBOARD ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 2. ALL ASSIGNED PROJECTS LIST
// GET /api/gd/projects
// Query: status, search, page, limit
// =====================================

exports.getProjects = async (req, res) => {
  try {
    const designerId = req.user.id;

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = { designer: designerId };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }

    const [projects, total] = await Promise.all([
      DesignProject.find(filter)
        .populate("client", "name email companyName")
        .select("title designType priority deadline status progressPercentage createdAt")
        .sort({ deadline: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DesignProject.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg:  "Projects fetched successfully",
      data: {
        projects,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("GD GET PROJECTS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 3. SINGLE PROJECT DETAILS
// GET /api/gd/projects/:id
// =====================================

exports.getProjectDetails = async (req, res) => {
  try {
    const designerId = req.user.id;

    const project = await DesignProject.findOne({
      _id:      req.params.id,
      designer: designerId
    })
      .populate("client",     "name email companyName phoneNumber")
      .populate("assignedBy", "name email")
      .lean();

    if (!project) {
      return res.status(404).json({ success: false, msg: "Project not found" });
    }

    const [files, revisions] = await Promise.all([
      DesignFile.find({ project: project._id }).sort({ createdAt: -1 }).lean(),
      Revision.find({ project: project._id })
        .populate("requestedBy", "name email")
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      msg:  "Project details fetched successfully",
      data: {
        project,
        files,
        revisions,
        revisionInfo: {
          used:      project.revisionCount,
          limit:     project.revisionLimit,
          remaining: project.revisionLimit - project.revisionCount
        }
      }
    });

  } catch (error) {
    console.error("GD GET PROJECT DETAILS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 4. UPDATE STATUS & PROGRESS
// PUT /api/gd/projects/:id/progress
// Body: { status, progressPercentage, internalNotes }
// =====================================

exports.updateProgress = async (req, res) => {
  try {
    const designerId = req.user.id;
    const { status, progressPercentage, internalNotes } = req.body;

    const project = await DesignProject.findOne({
      _id:      req.params.id,
      designer: designerId
    });

    if (!project) {
      return res.status(404).json({ success: false, msg: "Project not found" });
    }

    // Status change hone pe history mein add karo
    if (status && status !== project.status) {
      project.statusHistory.push({
        oldStatus: project.status,
        newStatus: status,
        changedBy: designerId,
        changedAt: new Date()
      });
      project.status = status;
    }

    if (progressPercentage !== undefined) project.progressPercentage = progressPercentage;
    if (internalNotes      !== undefined) project.internalNotes      = internalNotes;

    await project.save();

    return res.status(200).json({
      success: true,
      msg:  "Progress updated successfully",
      data: {
        status:             project.status,
        progressPercentage: project.progressPercentage,
        internalNotes:      project.internalNotes,
        statusHistory:      project.statusHistory
      }
    });

  } catch (error) {
    console.error("GD UPDATE PROGRESS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 5. DEADLINES — Today / Upcoming / Overdue
// GET /api/gd/projects/deadlines
// =====================================

exports.getDeadlines = async (req, res) => {
  try {
    const designerId = req.user.id;
    const today      = new Date();
    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(today); todayEnd.setHours(23, 59, 59, 999);

    const [todayProjects, upcomingProjects, overdueProjects] = await Promise.all([

      // Aaj deadline wale
      DesignProject.find({
        designer: designerId,
        deadline: { $gte: todayStart, $lte: todayEnd },
        status:   { $nin: ["Completed", "Cancelled"] }
      }).select("title designType deadline status priority").lean(),

      // Aane wale — next 7 days
      DesignProject.find({
        designer: designerId,
        deadline: { $gt: todayEnd },
        status:   { $nin: ["Completed", "Cancelled"] }
      })
        .sort({ deadline: 1 })
        .limit(10)
        .select("title designType deadline status priority")
        .lean(),

      // Overdue — deadline nikal gayi
      DesignProject.find({
        designer: designerId,
        deadline: { $lt: todayStart },
        status:   { $nin: ["Completed", "Cancelled"] }
      })
        .sort({ deadline: 1 })
        .select("title designType deadline status priority")
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      msg:  "Deadlines fetched successfully",
      data: { todayProjects, upcomingProjects, overdueProjects }
    });

  } catch (error) {
    console.error("GD GET DEADLINES ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

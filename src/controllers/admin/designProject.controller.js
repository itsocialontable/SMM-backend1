// ==========================================
// FILE: src/controllers/admin/designProject.controller.js
// FIXED v17: agencyId isolation added
// Admin sirf apni agency ke projects dekh sakta hai
// ==========================================

const DesignProject = require("../../models/designProject.model");
const DesignFile    = require("../../models/designFile.model");
const Revision      = require("../../models/revision.model");


// =====================================
// GET ALL DESIGN PROJECTS (admin)
// GET /api/admin/design-projects
// =====================================

exports.getAllProjects = async (req, res) => {
  try {
    const agencyId = req.user.id;   // 🔒

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    // 🔒 agencyId always in filter
    const filter = { agencyId };
    if (req.query.status)     filter.status   = req.query.status;
    if (req.query.designerId) filter.designer = req.query.designerId;
    if (req.query.clientId)   filter.client   = req.query.clientId;
    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }

    const [projects, total] = await Promise.all([
      DesignProject.find(filter)
        .populate("client",      "name email companyName")
        .populate("designer",    "name email")
        .populate("assignedBy",  "name email")
        .select("-comments -statusHistory -assets")
        .sort({ createdAt: -1 })
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
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });

  } catch (error) {
    console.error("ADMIN GET ALL PROJECTS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET SINGLE PROJECT DETAIL
// GET /api/admin/design-projects/:id
// =====================================

exports.getProjectDetail = async (req, res) => {
  try {
    const agencyId = req.user.id;   // 🔒

    // 🔒 agencyId check — dusri agency ka project nahi dekh sakta
    const project = await DesignProject.findOne({ _id: req.params.id, agencyId })
      .populate("client",     "name email companyName phoneNumber")
      .populate("designer",   "name email skills specialization")
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
      msg:  "Project detail fetched successfully",
      data: { project, files, revisions }
    });

  } catch (error) {
    console.error("ADMIN GET PROJECT DETAIL ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

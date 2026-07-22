// ==========================================
// FILE: src/controllers/admin/designProject.controller.js
// FIXED v17: agencyId isolation added
// Admin sirf apni agency ke projects dekh sakta hai
// UPDATED v20: Admin ab projects CREATE aur EDIT bhi kar sakta hai
//   (pehle sirf GET/read-only tha, SMM hi create/update kar sakta tha).
//   Logic SMM wale createProject/updateProject jaisa hi hai, bas
//   ownership check "assignedBy: req.user.id" ki jagah "agencyId" se
//   hota hai (kyunki admin khud agency hai, kisi SMM ka sub-record nahi).
// ==========================================

const DesignProject      = require("../../models/designProject.model");
const DesignFile         = require("../../models/designFile.model");
const Revision           = require("../../models/revision.model");
const User2               = require("../../models/user2.model");
const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");
const sendNotification     = require("../../utils/sendNotification.utils");


// =====================================
// CREATE PROJECT (admin)
// POST /api/admin/design-projects
// =====================================

exports.createProject = async (req, res) => {
  try {
    const agencyId = req.user.id;   // 🔒 admin khud agency hai

    const {
      clientId, designerId, title, designType,
      description, targetAudience, brandColors,
      fontPreferences, referenceLinks, priority,
      deadline, revisionLimit
    } = req.body;

    if (!clientId || !designerId || !title || !designType || !deadline) {
      cleanupTempFiles(req.files);
      return res.status(400).json({
        success: false,
        msg: "clientId, designerId, title, designType, deadline are required"
      });
    }

    // 🔒 Client aur Designer isi agency ke hone chahiye
    const [clientCheck, designerCheck] = await Promise.all([
      User2.findOne({ _id: clientId,   agencyId, role: "Client" }).lean(),
      User2.findOne({ _id: designerId, agencyId, role: "Graphic Designer" }).lean()
    ]);

    if (!clientCheck) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ success: false, msg: "Client does not belong to your agency" });
    }
    if (!designerCheck) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ success: false, msg: "Graphic Designer does not belong to your agency" });
    }

    let assets = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.path, file.mimetype, "smm-uploads/project-assets");
        assets.push({ url: result.secure_url, publicId: result.public_id, label: file.originalname });
      }
      cleanupTempFiles(req.files);
    }

    const project = await DesignProject.create({
      agencyId,
      client:         clientId,
      designer:       designerId,
      assignedBy:     req.user.id,   // admin khud "assign karne wala" bhi hai
      title, designType,
      description:    description    || "",
      targetAudience: targetAudience || "",
      brandColors: brandColors
        ? (Array.isArray(brandColors) ? brandColors : brandColors.split(",").map(c => c.trim()))
        : [],
      fontPreferences: fontPreferences || "",
      referenceLinks: referenceLinks
        ? (Array.isArray(referenceLinks) ? referenceLinks : referenceLinks.split(",").map(l => l.trim()))
        : [],
      priority:      priority      || "Medium",
      deadline:      new Date(deadline),
      revisionLimit: revisionLimit || 5,
      assets,
      statusHistory: [{ oldStatus: null, newStatus: "Pending", changedBy: req.user.id, changedAt: new Date() }]
    });

    await project.populate([
      { path: "client",   select: "name email companyName" },
      { path: "designer", select: "name email" }
    ]);

    await sendNotification({
      userId:    designerId,
      type:      "INFO",
      event:     "project_assigned",
      title:     "Naya project assign hua",
      message:   `You have been assigned the "${title}" project. Deadline: ${new Date(deadline).toLocaleDateString("en-IN")}`,
      projectId: project._id,
      templateData: {
        projectTitle: title,
        deadline:     new Date(deadline).toLocaleDateString("en-IN"),
        priority:     priority || "Medium"
      }
    });

    return res.status(201).json({
      success: true,
      msg:  "Project created and assigned to designer successfully",
      data: project
    });

  } catch (error) {
    cleanupTempFiles(req.files);
    console.error("ADMIN CREATE PROJECT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPDATE PROJECT (admin)
// PUT /api/admin/design-projects/:id
// =====================================

exports.updateProject = async (req, res) => {
  try {
    const agencyId = req.user.id;   // 🔒

    const PROTECTED = ["client", "designer", "assignedBy", "statusHistory", "comments", "_id", "agencyId"];
    PROTECTED.forEach(f => delete req.body[f]);

    const project = await DesignProject.findOneAndUpdate(
      { _id: req.params.id, agencyId },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("client designer", "name email");

    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    return res.status(200).json({ success: true, msg: "Project updated successfully", data: project });

  } catch (error) {
    console.error("ADMIN UPDATE PROJECT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// DELETE PROJECT (admin)
// DELETE /api/admin/design-projects/:id
// =====================================

exports.deleteProject = async (req, res) => {
  try {
    const agencyId = req.user.id;   // 🔒

    const project = await DesignProject.findOneAndDelete({ _id: req.params.id, agencyId });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    await Promise.all([
      DesignFile.deleteMany({ project: req.params.id }),
      Revision.deleteMany({   project: req.params.id })
    ]);

    return res.status(200).json({ success: true, msg: "Project deleted successfully" });

  } catch (error) {
    console.error("ADMIN DELETE PROJECT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


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

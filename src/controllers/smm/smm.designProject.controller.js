// ==========================================
// FILE: src/controllers/smm/smm.designProject.controller.js
// FIXED v17: agencyId saved on project creation (from SMM's own agencyId)
// ==========================================

const DesignProject      = require("../../models/designProject.model");
const DesignFile         = require("../../models/designFile.model");
const Revision           = require("../../models/revision.model");
const User2              = require("../../models/user2.model");
const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");
const sendNotification    = require("../../utils/sendNotification.utils");


// =====================================
// 1. CREATE PROJECT + GD ASSIGN KARO
// POST /api/smm/design-projects
// =====================================

exports.createProject = async (req, res) => {
  try {
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

    // 🔒 SMM ka agencyId fetch karo — wahi project pe save hoga
    const smmUser = await User2.findById(req.user.id).select("agencyId").lean();
    if (!smmUser || !smmUser.agencyId) {
      cleanupTempFiles(req.files);
      return res.status(403).json({
        success: false,
        msg: "SMM user's agencyId not found. Please contact Admin."
      });
    }
    const agencyId = smmUser.agencyId;

    // 🔒 Client aur Designer bhi isi agency ke hone chahiye
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

    // Assets upload
    let assets = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.path, file.mimetype, "smm-uploads/project-assets");
        assets.push({ url: result.secure_url, publicId: result.public_id, label: file.originalname });
      }
      cleanupTempFiles(req.files);
    }

    const project = await DesignProject.create({
      agencyId,                      // 🔒 agency tag
      client:         clientId,
      designer:       designerId,
      assignedBy:     req.user.id,
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
    console.error("SMM CREATE PROJECT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 2. GET ALL PROJECTS
// GET /api/smm/design-projects
// =====================================

exports.getAllProjects = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    // SMM sirf apne assigned projects dekhe — assignedBy filter already isolates correctly
    const filter = { assignedBy: req.user.id };
    if (req.query.status)     filter.status   = req.query.status;
    if (req.query.clientId)   filter.client   = req.query.clientId;
    if (req.query.designerId) filter.designer = req.query.designerId;
    if (req.query.search)     filter.title    = { $regex: req.query.search, $options: "i" };

    const [projects, total] = await Promise.all([
      DesignProject.find(filter)
        .populate("client",   "name email companyName")
        .populate("designer", "name email")
        .select("-comments -statusHistory -assets")
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      DesignProject.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg: "Projects fetched successfully",
      data: { projects, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } }
    });

  } catch (error) {
    console.error("SMM GET ALL PROJECTS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 3. GET SINGLE PROJECT DETAIL
// GET /api/smm/design-projects/:id
// =====================================

exports.getProjectDetail = async (req, res) => {
  try {
    const project = await DesignProject.findOne({ _id: req.params.id, assignedBy: req.user.id })
      .populate("client",   "name email companyName phoneNumber")
      .populate("designer", "name email skills specialization")
      .lean();

    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    const [files, revisions] = await Promise.all([
      DesignFile.find({ project: project._id }).sort({ createdAt: -1 }).lean(),
      Revision.find({ project: project._id }).populate("requestedBy", "name email").sort({ createdAt: -1 }).lean()
    ]);

    return res.status(200).json({
      success: true,
      msg: "Project detail fetched successfully",
      data: {
        project, files, revisions,
        revisionInfo: {
          used:      project.revisionCount,
          limit:     project.revisionLimit,
          remaining: project.revisionLimit - project.revisionCount
        }
      }
    });

  } catch (error) {
    console.error("SMM GET PROJECT DETAIL ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 4. UPDATE PROJECT
// PUT /api/smm/design-projects/:id
// =====================================

exports.updateProject = async (req, res) => {
  try {
    const PROTECTED = ["client", "designer", "assignedBy", "statusHistory", "comments", "_id", "agencyId"];
    PROTECTED.forEach(f => delete req.body[f]);

    const project = await DesignProject.findOneAndUpdate(
      { _id: req.params.id, assignedBy: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate("client designer", "name email");

    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    return res.status(200).json({ success: true, msg: "Project updated successfully", data: project });

  } catch (error) {
    console.error("SMM UPDATE PROJECT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 5. DELETE PROJECT
// DELETE /api/smm/design-projects/:id
// =====================================

exports.deleteProject = async (req, res) => {
  try {
    const project = await DesignProject.findOneAndDelete({ _id: req.params.id, assignedBy: req.user.id });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    await Promise.all([
      DesignFile.deleteMany({ project: req.params.id }),
      Revision.deleteMany({   project: req.params.id })
    ]);

    return res.status(200).json({ success: true, msg: "Project deleted successfully" });

  } catch (error) {
    console.error("SMM DELETE PROJECT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 6. REQUEST REVISION
// POST /api/smm/design-projects/:id/revisions
// =====================================

exports.requestRevision = async (req, res) => {
  try {
    const { revisionMessage } = req.body;
    if (!revisionMessage?.trim()) {
      return res.status(400).json({ success: false, msg: "Revision message is required" });
    }

    const project = await DesignProject.findOne({ _id: req.params.id, assignedBy: req.user.id });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    if (project.revisionCount >= project.revisionLimit) {
      return res.status(400).json({
        success: false,
        msg: `Revision limit reached (${project.revisionLimit}/${project.revisionLimit})`
      });
    }

    const oldStatus = project.status;
    project.revisionCount += 1;
    project.status = "Revision";
    project.statusHistory.push({ oldStatus, newStatus: "Revision", changedBy: req.user.id, changedAt: new Date() });
    await project.save();

    const revision = await Revision.create({
      project:         project._id,
      requestedBy:     req.user.id,
      revisionMessage: revisionMessage.trim(),
      revisionNumber:  project.revisionCount
    });

    await sendNotification({
      userId:    project.designer,
      type:      "WARNING",
      event:     "revision_requested",
      title:     "Revision Request Aaya",
      message:   `A revision (#${project.revisionCount}) has been requested for the "${project.title}" project: "${revisionMessage.trim()}"`,
      projectId: project._id
    });

    return res.status(201).json({
      success: true,
      msg: "Revision requested successfully",
      data: {
        revision,
        revisionInfo: { used: project.revisionCount, limit: project.revisionLimit, remaining: project.revisionLimit - project.revisionCount }
      }
    });

  } catch (error) {
    console.error("SMM REQUEST REVISION ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 7. ADD COMMENT
// POST /api/smm/design-projects/:id/comments
// =====================================

exports.addComment = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, msg: "Message is required" });

    const project = await DesignProject.findOne({ _id: req.params.id, assignedBy: req.user.id });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    project.comments.push({ sender: req.user.id, senderRole: "SMM", message: message.trim() });
    await project.save();

    const lastComment = project.comments[project.comments.length - 1];
    return res.status(201).json({ success: true, msg: "Comment added", data: lastComment });

  } catch (error) {
    console.error("SMM ADD COMMENT ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 8. GET COMMENTS
// GET /api/smm/design-projects/:id/comments
// =====================================

exports.getComments = async (req, res) => {
  try {
    const project = await DesignProject.findOne({ _id: req.params.id, assignedBy: req.user.id })
      .select("comments")
      .populate("comments.sender", "name profileImage role")
      .lean();

    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    return res.status(200).json({ success: true, msg: "Comments fetched", data: { comments: project.comments } });

  } catch (error) {
    console.error("SMM GET COMMENTS ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// NOTE (v18): smmReviewProject yahan se hata diya gaya hai.
// Ye function "smm.dashboard.controller.js" me bhi duplicate define
// tha, aur smm.routes.js sirf usi (dashboard controller wale) ko
// import karta hai — ye wala kabhi route se wired hi nahi tha, sirf
// dead/confusing duplicate code tha. Asli implementation ab sirf
// smm.dashboard.controller.js me hai.
// =====================================

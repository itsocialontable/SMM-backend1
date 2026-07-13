// FILE: src/controllers/graphicDesigner/gd.work.controller.js

const DesignProject      = require("../../models/designProject.model");
const DesignFile         = require("../../models/designFile.model");
const Revision           = require("../../models/revision.model");
const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");
const cloudinary          = require("../../config/cloudinary.config");
const sendNotification    = require("../../utils/sendNotification.utils");


// ── 1. SUBMIT FOR REVIEW (GD → SMM ko bhejta hai, client ko NAHI) ───────────
// PATCH /api/gd/projects/:id/submit-for-review
// GD design submit karta hai → status "SMM Review" (pehle SMM dekhega)
exports.submitForReview = async (req, res) => {
  try {
    const designerId = req.user.id;

    const project = await DesignProject.findOne({
      _id:      req.params.id,
      designer: designerId
    });

    if (!project) {
      return res.status(404).json({ success: false, msg: "Project not found" });
    }

    // Sirf In Progress ya Revision status wala project submit ho sakta hai
    const allowedStatuses = ["In Progress", "Revision"];
    if (!allowedStatuses.includes(project.status)) {
      return res.status(400).json({
        success: false,
        msg: `Project status '${project.status}' hai — sirf 'In Progress' ya 'Revision' project submit ho sakta hai`
      });
    }

    // Check — koi Final file upload hui hai ya nahi
    const finalFile = await DesignFile.findOne({
      project:  project._id,
      fileType: "Final"
    });

    if (!finalFile) {
      return res.status(400).json({
        success: false,
        msg: "Pehle Final design file upload karo, phir Submit for Review karo"
      });
    }

    // Status → "SMM Review" (client tak abhi nahi jayega)
    const oldStatus = project.status;
    project.status  = "SMM Review";
    project.statusHistory.push({
      oldStatus,
      newStatus: "SMM Review",
      changedBy: designerId,
      changedAt: new Date()
    });
    await project.save();

    // ── Sirf SMM ko notify karo ──────────────────────────────────────────────
    await sendNotification({
      userId:    project.assignedBy,
      type:      "INFO",
      event:     "design_submitted_to_smm",
      title:     "GD ne Design Submit Kiya — Review Karo",
      message:   `"${project.title}" project ka design ready hai. Please review karke client ko bhejo ya revision request karo.`,
      projectId: project._id,
      templateData: {
        projectTitle: project.title
      }
    });

    return res.status(200).json({
      success: true,
      msg: "Design SMM ko review ke liye bhej diya gaya. SMM approve karega tabhi client dekh sakega.",
      data: {
        projectId: project._id,
        title:     project.title,
        status:    project.status
      }
    });

  } catch (error) {
    console.error("GD SUBMIT FOR REVIEW ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 2. UPLOAD DESIGN FILE (Draft / Final) ────────────────────────────────────
// POST /api/gd/projects/:id/files
exports.uploadDesignFile = async (req, res) => {
  try {
    const designerId = req.user.id;
    if (!req.file) return res.status(400).json({ success: false, msg: "File is required" });

    const project = await DesignProject.findOne({ _id: req.params.id, designer: designerId });
    if (!project) {
      cleanupTempFiles([req.file]);
      return res.status(404).json({ success: false, msg: "Project not found" });
    }

    const fileType = req.body.fileType || "Draft";
    const existingFiles = await DesignFile.find({ project: project._id, fileType });
    const version = existingFiles.length + 1;

    const result = await uploadToCloudinary(req.file.path, req.file.mimetype, "smm-uploads/design-files");
    cleanupTempFiles([req.file]);

    const designFile = await DesignFile.create({
      project:      project._id,
      uploadedBy:   designerId,
      fileName:     req.body.fileName || req.file.originalname,
      fileUrl:      result.secure_url,
      filePublicId: result.public_id,
      fileFormat:   result.format,
      fileSize:     result.bytes,
      version,
      fileType
    });

    return res.status(201).json({
      success: true,
      msg:  `${fileType} v${version} upload ho gaya`,
      data: designFile
    });

  } catch (error) {
    cleanupTempFiles([req.file]);
    console.error("GD UPLOAD FILE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 3. GET ALL FILES ──────────────────────────────────────────────────────────
// GET /api/gd/projects/:id/files
exports.getProjectFiles = async (req, res) => {
  try {
    const project = await DesignProject.findOne({ _id: req.params.id, designer: req.user.id });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    const files = await DesignFile.find({ project: project._id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: { files } });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 4. REPLY TO REVISION ─────────────────────────────────────────────────────
// PUT /api/gd/revisions/:revisionId/reply
exports.replyToRevision = async (req, res) => {
  try {
    const designerId = req.user.id;
    const { designerReply, status } = req.body;

    const revision = await Revision.findById(req.params.revisionId).populate("project");
    if (!revision) return res.status(404).json({ success: false, msg: "Revision not found" });

    if (revision.project.designer.toString() !== designerId) {
      return res.status(403).json({ success: false, msg: "Access denied" });
    }

    if (designerReply !== undefined) revision.designerReply = designerReply;
    if (status        !== undefined) revision.status        = status;
    await revision.save();

    return res.status(200).json({ success: true, msg: "Revision reply updated", data: revision });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 5. UPLOAD UPDATED DESIGN FOR REVISION ────────────────────────────────────
// POST /api/gd/revisions/:revisionId/upload
exports.uploadRevisionDesign = async (req, res) => {
  try {
    const designerId = req.user.id;
    if (!req.file) return res.status(400).json({ success: false, msg: "File is required" });

    const revision = await Revision.findById(req.params.revisionId).populate("project");
    if (!revision) { cleanupTempFiles([req.file]); return res.status(404).json({ success: false, msg: "Revision not found" }); }

    if (revision.project.designer.toString() !== designerId) {
      cleanupTempFiles([req.file]);
      return res.status(403).json({ success: false, msg: "Access denied" });
    }

    if (revision.updatedFilePublicId) {
      await cloudinary.uploader.destroy(revision.updatedFilePublicId, { resource_type: "raw" });
    }

    const result = await uploadToCloudinary(req.file.path, req.file.mimetype, "smm-uploads/revision-files");
    cleanupTempFiles([req.file]);

    revision.updatedFileUrl      = result.secure_url;
    revision.updatedFilePublicId = result.public_id;
    revision.status              = "Resolved";
    await revision.save();

    return res.status(200).json({ success: true, msg: "Updated design uploaded", data: revision });
  } catch (error) {
    cleanupTempFiles([req.file]);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 6. ADD COMMENT ───────────────────────────────────────────────────────────
// POST /api/gd/projects/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, msg: "Message is required" });

    const project = await DesignProject.findOne({ _id: req.params.id, designer: req.user.id });
    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });

    project.comments.push({ sender: req.user.id, senderRole: "Graphic Designer", message: message.trim() });
    await project.save();

    return res.status(201).json({
      success: true,
      msg:  "Comment added",
      data: project.comments[project.comments.length - 1]
    });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// ── 7. GET ALL COMMENTS ──────────────────────────────────────────────────────
// GET /api/gd/projects/:id/comments
exports.getComments = async (req, res) => {
  try {
    const project = await DesignProject.findOne({ _id: req.params.id, designer: req.user.id })
      .select("comments")
      .populate("comments.sender", "name profileImage role")
      .lean();

    if (!project) return res.status(404).json({ success: false, msg: "Project not found" });
    return res.status(200).json({ success: true, data: { comments: project.comments } });
  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

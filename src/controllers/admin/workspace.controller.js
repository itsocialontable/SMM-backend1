// ==========================================
// FILE: src/controllers/admin/workspace.controller.js
// UPDATED v18: Workspace ab Agency se linked hai (Admin model hata diya gaya)
// ==========================================

const Workspace          = require("../../models/workspace.model");
const cloudinary         = require("../../config/cloudinary.config");
const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");


// =====================================
// HELPER: Workspace get karo ya create karo
// Agency ka pehli baar workspace nahi hoga — auto create karo
// =====================================

const getOrCreateWorkspace = async (agencyId) => {
  let workspace = await Workspace.findOne({ agency: agencyId });
  if (!workspace) {
    workspace = await Workspace.create({ agency: agencyId });
    console.log("✅ Workspace auto-created for agency:", agencyId);
  }
  return workspace;
};


// =====================================
// GET WORKSPACE
// GET /api/admin/workspace
// =====================================

exports.getWorkspace = async (req, res) => {
  try {

    const workspace = await getOrCreateWorkspace(req.user.id);

    return res.status(200).json({
      success: true,
      msg:  "Workspace fetched successfully",
      data: workspace
    });

  } catch (error) {
    console.error("GET WORKSPACE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPDATE WORKSPACE (agency info, timezone, platforms, hours, notifications, branding)
// PUT /api/admin/workspace
// =====================================

exports.updateWorkspace = async (req, res) => {
  try {

    const workspace = await getOrCreateWorkspace(req.user.id);

    const {
      agencyName,
      agencyWebsite,
      agencyEmail,
      agencyPhone,
      agencyAddress,
      timezone,
      defaultPlatforms,
      businessHours,
      notifications,
      branding
    } = req.body;

    // ---- sirf jo fields aayi hain wo update karo ----
    if (agencyName    !== undefined) workspace.agencyName    = agencyName.trim();
    if (agencyWebsite !== undefined) workspace.agencyWebsite = agencyWebsite.trim();
    if (agencyEmail   !== undefined) workspace.agencyEmail   = agencyEmail.trim().toLowerCase();
    if (agencyPhone   !== undefined) workspace.agencyPhone   = agencyPhone.trim();
    if (agencyAddress !== undefined) workspace.agencyAddress = agencyAddress.trim();
    if (timezone      !== undefined) workspace.timezone      = timezone;

    // ---- default platforms ----
    if (defaultPlatforms !== undefined) {
      const allowed = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube"];
      const filtered = defaultPlatforms.filter(p => allowed.includes(p));
      workspace.defaultPlatforms = filtered;
    }

    // ---- business hours ----
    if (businessHours !== undefined) {
      if (businessHours.start !== undefined) workspace.businessHours.start = businessHours.start;
      if (businessHours.end   !== undefined) workspace.businessHours.end   = businessHours.end;
      if (businessHours.days  !== undefined) workspace.businessHours.days  = businessHours.days;
    }

    // ---- notification preferences ----
    if (notifications !== undefined) {
      if (notifications.emailOnPostPublished !== undefined)
        workspace.notifications.emailOnPostPublished = notifications.emailOnPostPublished;
      if (notifications.emailOnPostFailed !== undefined)
        workspace.notifications.emailOnPostFailed = notifications.emailOnPostFailed;
      if (notifications.emailOnNewUser !== undefined)
        workspace.notifications.emailOnNewUser = notifications.emailOnNewUser;
      if (notifications.emailOnUserDeleted !== undefined)
        workspace.notifications.emailOnUserDeleted = notifications.emailOnUserDeleted;
    }

    // ---- branding ----
    if (branding !== undefined) {
      if (branding.primaryColor !== undefined) workspace.branding.primaryColor = branding.primaryColor;
      if (branding.accentColor  !== undefined) workspace.branding.accentColor  = branding.accentColor;
    }

    await workspace.save();

    return res.status(200).json({
      success: true,
      msg:  "Workspace updated successfully",
      data: workspace
    });

  } catch (error) {
    console.error("UPDATE WORKSPACE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPLOAD / UPDATE AGENCY LOGO
// POST /api/admin/workspace/logo
// Body: form-data → field name: "agencyLogo"
// =====================================

exports.uploadAgencyLogo = async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ success: false, msg: "Logo image is required" });
    }

    const workspace = await getOrCreateWorkspace(req.user.id);

    // ---- purana logo Cloudinary se delete karo ----
    if (workspace.agencyLogoPublicId) {
      await cloudinary.uploader.destroy(workspace.agencyLogoPublicId, {
        resource_type: "image"
      });
      console.log("🗑️ Old agency logo deleted:", workspace.agencyLogoPublicId);
    }

    // ---- naya logo upload karo ----
    const result = await uploadToCloudinary(
      req.file.path,
      req.file.mimetype,
      "smm-uploads/agency-logos"
    );

    cleanupTempFiles([req.file]);

    workspace.agencyLogo          = result.secure_url;
    workspace.agencyLogoPublicId  = result.public_id;
    await workspace.save();

    return res.status(200).json({
      success: true,
      msg:  "Agency logo uploaded successfully",
      data: {
        agencyLogo: workspace.agencyLogo,
        workspace
      }
    });

  } catch (error) {
    cleanupTempFiles([req.file]);
    console.error("UPLOAD AGENCY LOGO ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// REMOVE AGENCY LOGO
// DELETE /api/admin/workspace/logo
// =====================================

exports.removeAgencyLogo = async (req, res) => {
  try {

    const workspace = await getOrCreateWorkspace(req.user.id);

    if (!workspace.agencyLogoPublicId) {
      return res.status(400).json({
        success: false,
        msg: "No agency logo to remove"
      });
    }

    // ---- Cloudinary se delete ----
    await cloudinary.uploader.destroy(workspace.agencyLogoPublicId, {
      resource_type: "image"
    });

    console.log("🗑️ Agency logo deleted:", workspace.agencyLogoPublicId);

    workspace.agencyLogo         = null;
    workspace.agencyLogoPublicId = null;
    await workspace.save();

    return res.status(200).json({
      success: true,
      msg: "Agency logo removed successfully"
    });

  } catch (error) {
    console.error("REMOVE AGENCY LOGO ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

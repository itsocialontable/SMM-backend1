// ==========================================
// FILE: src/controllers/agencyBranding/agencyBranding.controller.js
// NEW v16: Agency Branding Module
// ==========================================

const Agency             = require("../../models/agency.model");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");

let cloudinary;
try { cloudinary = require("../../config/cloudinary.config"); } catch(e) { cloudinary = null; }

// GET BRANDING
exports.getBranding = async (req, res) => {
  try {
    const agency = await Agency.findById(req.user.id).select("branding name email").lean();
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });
    return res.status(200).json({ success: true, msg: "Branding fetched successfully", data: { branding: agency.branding || {} } });
  } catch (err) {
    console.error("GET BRANDING ERROR =>", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};

// UPDATE BRANDING TEXT FIELDS
exports.updateBranding = async (req, res) => {
  try {
    const { companyDescription, websiteUrl, socialLinks } = req.body;
    const agency = await Agency.findById(req.user.id);
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });
    if (!agency.branding) agency.branding = {};

    if (companyDescription !== undefined) {
      if (companyDescription.length > 1000) {
        return res.status(400).json({ success: false, msg: "Company description must be 1000 characters or less" });
      }
      agency.branding.companyDescription = companyDescription.trim();
    }
    if (websiteUrl !== undefined) {
      if (websiteUrl && !/^https?:\/\/.+/.test(websiteUrl.trim())) {
        return res.status(400).json({ success: false, msg: "websiteUrl must start with http:// or https://" });
      }
      agency.branding.websiteUrl = websiteUrl.trim();
    }
    if (socialLinks && typeof socialLinks === "object") {
      if (!agency.branding.socialLinks) agency.branding.socialLinks = {};
      const allowed = ["facebook", "instagram", "twitter", "linkedin", "youtube"];
      for (const key of allowed) {
        if (socialLinks[key] !== undefined) {
          agency.branding.socialLinks[key] = socialLinks[key].trim();
        }
      }
    }
    agency.markModified("branding");
    await agency.save();
    return res.status(200).json({ success: true, msg: "Branding updated successfully", data: { branding: agency.branding } });
  } catch (err) {
    console.error("UPDATE BRANDING ERROR =>", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};

// UPLOAD COMPANY LOGO
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: "Logo file is required" });
    const agency = await Agency.findById(req.user.id);
    if (!agency) { cleanupTempFiles([req.file]); return res.status(404).json({ success: false, msg: "Agency not found" }); }

    if (agency.branding && agency.branding.companyLogoPublicId && cloudinary) {
      try { await cloudinary.uploader.destroy(agency.branding.companyLogoPublicId); } catch (e) { console.error("OLD LOGO DELETE:", e.message); }
    }

    const result = await uploadToCloudinary(req.file.path, req.file.mimetype, "smm-agency-logos");
    cleanupTempFiles([req.file]);
    if (!agency.branding) agency.branding = {};
    agency.branding.companyLogo         = result.secure_url;
    agency.branding.companyLogoPublicId = result.public_id;
    agency.markModified("branding");
    await agency.save();
    return res.status(200).json({ success: true, msg: "Company logo uploaded successfully", data: { companyLogo: agency.branding.companyLogo } });
  } catch (err) {
    cleanupTempFiles(req.file ? [req.file] : []);
    console.error("UPLOAD LOGO ERROR =>", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};

// DELETE COMPANY LOGO
exports.deleteLogo = async (req, res) => {
  try {
    const agency = await Agency.findById(req.user.id);
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });
    if (agency.branding && agency.branding.companyLogoPublicId && cloudinary) {
      try { await cloudinary.uploader.destroy(agency.branding.companyLogoPublicId); } catch (e) { console.error("LOGO DELETE:", e.message); }
    }
    if (!agency.branding) agency.branding = {};
    agency.branding.companyLogo         = "";
    agency.branding.companyLogoPublicId = "";
    agency.markModified("branding");
    await agency.save();
    return res.status(200).json({ success: true, msg: "Company logo deleted successfully" });
  } catch (err) {
    console.error("DELETE LOGO ERROR =>", err);
    return res.status(500).json({ success: false, msg: err.message });
  }
};

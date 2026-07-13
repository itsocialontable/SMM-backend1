// ==========================================
// FILE: src/controllers/admin/profile.controller.js
// UPDATED v18: Admin model hata diya — Agency hi apna profile manage karti hai
//              Admin model nahi hai isme, Agency model use ho raha hai
// ==========================================

const Agency              = require("../../models/agency.model");
const bcrypt              = require("bcryptjs");
const cloudinary          = require("../../config/cloudinary.config");
const uploadToCloudinary  = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");


// =====================================
// GET AGENCY PROFILE
// GET /api/admin/profile
// =====================================

exports.getAdminProfile = async (req, res) => {
  try {

    const agency = await Agency.findById(req.user.id).select(
      "-password -resetOtp -resetOtpExpire -resetOtpVerified"
    );

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    return res.status(200).json({ success: true, data: agency });

  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPDATE AGENCY PROFILE (name, owner, email, phoneNumber)
// PUT /api/admin/profile
// =====================================

exports.updateAdminProfile = async (req, res) => {
  try {

    const updateData = {};
    if (req.body.name)        updateData.name        = req.body.name.trim();
    if (req.body.owner)       updateData.owner       = req.body.owner.trim();
    if (req.body.email)       updateData.email       = req.body.email.trim().toLowerCase();
    if (req.body.phoneNumber) updateData.phoneNumber = req.body.phoneNumber.trim();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        msg: "At least one field required to update"
      });
    }

    if (updateData.email) {
      const duplicate = await Agency.findOne({ email: updateData.email, _id: { $ne: req.user.id } });
      if (duplicate) {
        return res.status(400).json({ success: false, msg: "Email already in use by another agency" });
      }
    }

    const updatedAgency = await Agency.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password -resetOtp -resetOtpExpire -resetOtpVerified");

    if (!updatedAgency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    return res.status(200).json({
      success: true,
      msg:  "Profile updated successfully",
      data: updatedAgency
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, msg: "Email already in use" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPLOAD / UPDATE PROFILE IMAGE
// POST /api/admin/profile/image
// Body: form-data → field name: "profileImage"
// =====================================

exports.uploadProfileImage = async (req, res) => {
  try {

    // ---- file check ----
    if (!req.file) {
      return res.status(400).json({ success: false, msg: "Image file is required" });
    }

    // ---- find agency ----
    const agency = await Agency.findById(req.user.id);
    if (!agency) {
      cleanupTempFiles([req.file]);
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    // ---- purani image Cloudinary se delete karo ----
    if (agency.profileImagePublicId) {
      await cloudinary.uploader.destroy(agency.profileImagePublicId, {
        resource_type: "image"
      });
      console.log("🗑️ Old profile image deleted from Cloudinary:", agency.profileImagePublicId);
    }

    // ---- nayi image upload karo ----
    const result = await uploadToCloudinary(
      req.file.path,
      req.file.mimetype,
      "smm-uploads/agency-profiles"
    );

    // ---- temp file delete ----
    cleanupTempFiles([req.file]);

    // ---- agency update karo ----
    agency.profileImage         = result.secure_url;
    agency.profileImagePublicId = result.public_id;
    await agency.save();

    const agencyData = agency.toObject();
    delete agencyData.password;
    delete agencyData.resetOtp;
    delete agencyData.resetOtpExpire;
    delete agencyData.resetOtpVerified;

    return res.status(200).json({
      success: true,
      msg:  "Profile image uploaded successfully",
      data: {
        profileImage: agency.profileImage,
        agency:       agencyData
      }
    });

  } catch (error) {
    cleanupTempFiles([req.file]);
    console.error("UPLOAD PROFILE IMAGE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// REMOVE PROFILE IMAGE
// DELETE /api/admin/profile/image
// =====================================

exports.removeProfileImage = async (req, res) => {
  try {

    const agency = await Agency.findById(req.user.id);

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    if (!agency.profileImagePublicId) {
      return res.status(400).json({
        success: false,
        msg: "No profile image to remove"
      });
    }

    // ---- Cloudinary se delete karo ----
    await cloudinary.uploader.destroy(agency.profileImagePublicId, {
      resource_type: "image"
    });

    console.log("🗑️ Profile image deleted from Cloudinary:", agency.profileImagePublicId);

    // ---- MongoDB update karo ----
    agency.profileImage         = null;
    agency.profileImagePublicId = null;
    await agency.save();

    return res.status(200).json({
      success: true,
      msg: "Profile image removed successfully"
    });

  } catch (error) {
    console.error("REMOVE PROFILE IMAGE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// CHANGE PASSWORD
// PUT /api/admin/change-password
// =====================================

exports.changeAdminPassword = async (req, res) => {
  try {

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, msg: "All fields required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, msg: "New password must be at least 8 characters" });
    }

    const agency = await Agency.findById(req.user.id);

    if (!agency) {
      return res.status(404).json({ success: false, msg: "Agency not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, agency.password);

    if (!isMatch) {
      return res.status(400).json({ success: false, msg: "Old password is incorrect" });
    }

    agency.password = await bcrypt.hash(newPassword, 10);
    await agency.save();

    return res.status(200).json({ success: true, msg: "Password changed successfully" });

  } catch (error) {
    return res.status(500).json({ success: false, msg: error.message });
  }
};

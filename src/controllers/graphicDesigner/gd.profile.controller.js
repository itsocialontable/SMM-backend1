// ==========================================
// FILE: src/controllers/graphicDesigner/gd.profile.controller.js
// GET  /api/gd/profile
// PUT  /api/gd/profile
// POST /api/gd/profile/image
// DEL  /api/gd/profile/image
// ==========================================

const User2          = require("../../models/user2.model");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");
const cloudinary     = require("../../config/cloudinary.config");


// =====================================
// 1. GET PROFILE
// GET /api/gd/profile
// =====================================

exports.getProfile = async (req, res) => {
  try {
    const user = await User2.findById(req.user.id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    return res.status(200).json({
      success: true,
      msg: "Profile fetched",
      data: { user }
    });

  } catch (error) {
    console.error("GD GET PROFILE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 2. UPDATE PROFILE
// PUT /api/gd/profile
// Body: name, phoneNumber, skills, specialization, experience
// =====================================

exports.updateProfile = async (req, res) => {
  try {
    // Protected fields — badal nahi sakte
    const PROTECTED = ["email", "password", "role", "isActive", "_id"];
    PROTECTED.forEach(f => delete req.body[f]);

    const user = await User2.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    return res.status(200).json({
      success: true,
      msg: "Profile updated successfully",
      data: { user }
    });

  } catch (error) {
    console.error("GD UPDATE PROFILE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 3. UPLOAD PROFILE IMAGE
// POST /api/gd/profile/image
// form-data: profileImage (file)
// =====================================

exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, msg: "Image file required. Field name: profileImage" });
    }

    const user = await User2.findById(req.user.id);
    if (!user) {
      cleanupTempFiles([req.file]);
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    // Purani image delete karo Cloudinary se
    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    }

    const result = await uploadToCloudinary(
      req.file.path,
      req.file.mimetype,
      "smm-uploads/gd-profiles"
    );
    cleanupTempFiles([req.file]);

    user.profileImage         = result.secure_url;
    user.profileImagePublicId = result.public_id;
    await user.save();

    return res.status(200).json({
      success: true,
      msg: "Profile image uploaded",
      data: { profileImage: user.profileImage }
    });

  } catch (error) {
    cleanupTempFiles([req.file]);
    console.error("GD UPLOAD PROFILE IMAGE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// 4. REMOVE PROFILE IMAGE
// DELETE /api/gd/profile/image
// =====================================

exports.removeProfileImage = async (req, res) => {
  try {
    const user = await User2.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (!user.profileImage) {
      return res.status(400).json({ success: false, msg: "Koi profile image nahi hai" });
    }

    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    }

    user.profileImage         = null;
    user.profileImagePublicId = null;
    await user.save();

    return res.status(200).json({
      success: true,
      msg: "Profile image removed"
    });

  } catch (error) {
    console.error("GD REMOVE PROFILE IMAGE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

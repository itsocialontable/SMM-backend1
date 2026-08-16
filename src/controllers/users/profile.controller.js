// ==========================================
// FILE: src/controllers/users/profile.controller.js
// FIXED: Now uses User2 model (old user.model.js removed)
//        deleteProfile now does soft delete (isActive: false)
// ==========================================

const User2 = require("../../models/user2.model");
const bcrypt = require("bcryptjs");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const { cleanupTempFiles } = require("../../middleware/upload.middleware");
const cloudinary = require("../../config/cloudinary.config");

// ================= GET PROFILE =================
exports.getProfile = async (req, res) => {
  try {
    const user = await User2.findOne({ _id: req.user.id, isActive: true })
      .select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({ success: true, data: user });

  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// ================= UPDATE PROFILE =================
exports.updateProfile = async (req, res) => {
  try {
    const { name, phoneNumber, profileImage } = req.body;

    if (!name && !phoneNumber && !profileImage) {
      return res.status(400).json({ msg: "Nothing to update" });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (profileImage) updateData.profileImage = profileImage;

    const updatedUser = await User2.findOneAndUpdate(
      { _id: req.user.id, isActive: true },
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json({
      success: true,
      msg: "Profile updated successfully",
      data: updatedUser
    });

  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

// ================= UPLOAD PROFILE IMAGE =================
// POST /api/smm/profile/image
// form-data: profileImage (file)
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, msg: "Image file required. Field name: profileImage" });
    }

    const user = await User2.findOne({ _id: req.user.id, isActive: true });
    if (!user) {
      cleanupTempFiles([req.file]);
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    }

    const result = await uploadToCloudinary(
      req.file.path,
      req.file.mimetype,
      "smm-uploads/smm-profiles"
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
    console.error("SMM UPLOAD PROFILE IMAGE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// ================= REMOVE PROFILE IMAGE =================
// DELETE /api/smm/profile/image
exports.removeProfileImage = async (req, res) => {
  try {
    const user = await User2.findOne({ _id: req.user.id, isActive: true });
    if (!user) {
      return res.status(404).json({ success: false, msg: "User not found" });
    }

    if (!user.profileImage) {
      return res.status(400).json({ success: false, msg: "No profile image found" });
    }

    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    }

    user.profileImage         = null;
    user.profileImagePublicId = null;
    await user.save();

    return res.status(200).json({ success: true, msg: "Profile image removed" });

  } catch (error) {
    console.error("SMM REMOVE PROFILE IMAGE ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};

// ================= DELETE PROFILE (Soft Delete) =================
exports.deleteProfile = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ msg: "Password required" });
    }

    const user = await User2.findOne({ _id: req.user.id, isActive: true });

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: "Incorrect password" });
    }

    // Soft delete
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();

    return res.json({ success: true, msg: "Account deleted successfully" });

  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};
// ==========================================
// FILE: src/controllers/users/profile.controller.js
// FIXED: Now uses User2 model (old user.model.js removed)
//        deleteProfile now does soft delete (isActive: false)
// ==========================================

const User2 = require("../../models/user2.model");
const bcrypt = require("bcryptjs");

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

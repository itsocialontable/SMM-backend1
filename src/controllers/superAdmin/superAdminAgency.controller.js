// ==========================================
// FILE: src/controllers/superAdmin/superAdminAgency.controller.js
// UPDATED v16: Auto 3-day trial on agency creation
// ==========================================

const Agency = require("../../models/agency.model");
const bcrypt = require("bcryptjs");
const sendEmail = require("../../utils/email.util");


// =====================================
// CREATE AGENCY  (SuperAdmin only)
// POST /api/superadmin/agencies/create
// =====================================

exports.createAgency = async (req, res) => {
  try {
    const {
      name, owner, email, aadharCard, panCard,
      websiteOrSocialLink, password, confirmPassword,
      state, city, country, phoneNumber
    } = req.body;

    // ── Validation ──────────────────────────────────────────────────
    if (!name || !owner || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        msg: "Required fields: name, owner, email, password, confirmPassword"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, msg: "Passwords do not match" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, msg: "Password must be at least 8 characters" });
    }

    const existingAgency = await Agency.findOne({ email });
    if (existingAgency) {
      return res.status(400).json({ success: false, msg: "Agency with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Trial dates (3 days from now) ───────────────────────────────
    const now          = new Date();
    const trialEndDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // ── Create agency ───────────────────────────────────────────────
    const agency = await Agency.create({
      name, owner, email,
      password:            hashedPassword,
      aadharCard:          aadharCard          || "",
      panCard:             panCard             || "",
      websiteOrSocialLink: websiteOrSocialLink || "",
      state:               state               || "",
      city:                city                || "",
      country:             country             || "",
      phoneNumber:         phoneNumber         || "",
      // ── Subscription defaults ──
      trialStartDate:     now,
      trialEndDate:       trialEndDate,
      subscriptionStatus: "trial",
      planType:           "trial"
    });

    // ── Send welcome email ──────────────────────────────────────────
    try {
      await sendEmail({
        to:    email,
        name:  name,
        event: "agency_created",
        templateData: { email, password, agencyName: name, trialEndDate }
      });
    } catch (emailErr) {
      console.error("AGENCY WELCOME EMAIL ERROR =>", emailErr.message);
    }

    const agencyData = agency.toObject();
    delete agencyData.password;

    return res.status(201).json({
      success: true,
      msg:     "Agency created successfully. 3-day trial started. Login credentials sent to agency email.",
      agency:  agencyData
    });

  } catch (error) {
    console.error("CREATE AGENCY ERROR =>", error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, msg: "Email already in use" });
    }
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET ALL AGENCIES
// GET /api/superadmin/agencies
// =====================================

exports.getAllAgencies = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;
    const sort  = req.query.sort === "asc" ? 1 : -1;

    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { name:  { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
        { owner: { $regex: req.query.search, $options: "i" } }
      ];
    }
    if (req.query.subscriptionStatus) {
      filter.subscriptionStatus = req.query.subscriptionStatus;
    }

    const [agencies, total] = await Promise.all([
      Agency.find(filter).select("-password").sort({ createdAt: sort }).skip(skip).limit(limit).lean(),
      Agency.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      msg:     "Agencies fetched successfully",
      data: {
        agencies,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error("GET ALL AGENCIES ERROR =>", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// GET SINGLE AGENCY BY ID
// =====================================

exports.getAgencyById = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.id).select("-password").lean();
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });
    return res.status(200).json({ success: true, msg: "Agency fetched successfully", data: { agency } });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, msg: "Invalid agency ID" });
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// UPDATE AGENCY
// =====================================

exports.updateAgency = async (req, res) => {
  try {
    const PROTECTED = ["password", "role", "_id", "__v"];
    PROTECTED.forEach(f => delete req.body[f]);

    if (req.body.email) {
      req.body.email = req.body.email.toLowerCase().trim();
      const duplicate = await Agency.findOne({ email: req.body.email, _id: { $ne: req.params.id } });
      if (duplicate) return res.status(400).json({ success: false, msg: "Email already in use by another agency" });
    }

    const updatedAgency = await Agency.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedAgency) return res.status(404).json({ success: false, msg: "Agency not found" });

    return res.status(200).json({
      success: true,
      msg:     "Agency updated successfully",
      data:    { agency: updatedAgency }
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, msg: "Invalid agency ID" });
    if (error.code === 11000) return res.status(400).json({ success: false, msg: "Email already in use" });
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// ACTIVATE SUBSCRIPTION (SuperAdmin manually upgrades)
// PATCH /api/superadmin/agencies/:id/activate-subscription
// Body: { planType, durationDays }
// =====================================

exports.activateSubscription = async (req, res) => {
  try {
    const { planType = "pro", durationDays = 30 } = req.body;

    const validPlans = ["basic", "pro", "enterprise"];
    if (!validPlans.includes(planType)) {
      return res.status(400).json({ success: false, msg: "Invalid planType. Use: basic, pro, enterprise" });
    }

    const agency = await Agency.findById(req.params.id);
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });

    const now    = new Date();
    const expiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    agency.subscriptionStatus = "active";
    agency.planType           = planType;
    agency.subscriptionExpiry = expiry;
    await agency.save();

    const agencyData = agency.toObject();
    delete agencyData.password;

    return res.status(200).json({
      success: true,
      msg:     `Subscription activated (${planType}) for ${durationDays} days.`,
      data:    { agency: agencyData }
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, msg: "Invalid agency ID" });
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// TOGGLE AGENCY STATUS
// =====================================

exports.toggleAgencyStatus = async (req, res) => {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });

    agency.isActive = !agency.isActive;
    await agency.save();

    return res.status(200).json({
      success: true,
      msg:     `Agency ${agency.isActive ? "activated" : "deactivated"} successfully`,
      data:    { agencyId: agency._id, isActive: agency.isActive }
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, msg: "Invalid agency ID" });
    return res.status(500).json({ success: false, msg: error.message });
  }
};


// =====================================
// DELETE AGENCY
// =====================================

exports.deleteAgency = async (req, res) => {
  try {
    const agency = await Agency.findByIdAndDelete(req.params.id);
    if (!agency) return res.status(404).json({ success: false, msg: "Agency not found" });

    return res.status(200).json({
      success: true,
      msg:     "Agency deleted successfully",
      data:    { deletedAgencyId: agency._id }
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, msg: "Invalid agency ID" });
    return res.status(500).json({ success: false, msg: error.message });
  }
};

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // v18: notification User2 (team member) ko ja sakti hai ya Agency
    // ko (jaise account_connected jab Agency khud account connect kare)
    ownerType: { type: String, enum: ["User2", "Agency"], default: "User2" },
    userId:    { type: mongoose.Schema.Types.ObjectId, refPath: "ownerType", required: true, index: true },
    type:      { type: String, enum: ["SUCCESS","ERROR","INFO","WARNING"], default: "INFO" },
    event: {
      type: String,
      enum: [
        // Post events
        "post_created","post_scheduled","post_published","post_failed",
        // Social account events (v18 fix — pehle enum me nahi the)
        "account_connected","account_disconnected",
        // Design project — Option B final flow
        "project_assigned",      // GD ko  — SMM ne assign kiya
        "design_submitted",      // SMM + Client ko — GD ne Submit for Review kiya (AUTOMATIC)
        "design_submitted_to_smm", // SMM ko — GD ne Submit for Review kiya (v18 fix)
        "design_sent_to_client", // Client ko — SMM ne approve karke client ko bheja (v18 fix)
        "smm_approved_design",   // GD ko — SMM ne approve kar diya (v18 fix)
        "smm_rejected_design",   // GD ko — SMM ne reject kar diya (v18 fix)
        "client_approved",       // SMM + GD ko — client ne approve kiya
        "client_rejected",       // SMM + GD ko — client ne reject kiya
        "revision_requested",    // GD ko — SMM ne revision request ki
        "project_completed",     // GD ko — project final complete
        "comment_added"
      ]
    },
    title:     { type: String, trim: true },
    message:   { type: String, trim: true },
    isRead:    { type: Boolean, default: false, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "DesignProject", default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", notificationSchema);

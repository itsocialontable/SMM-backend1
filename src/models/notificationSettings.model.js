const mongoose = require("mongoose");

const notificationSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User2",
    required: true
  },
  
  activityAlerts: {
    postFailures: { type: Boolean, default: true },
    channelUpdates: { type: Boolean, default: true },
    collaboration: { type: Boolean, default: true },
    publishedConfirmation: { type: Boolean, default: true },
    emptyQueueAlerts: { type: Boolean, default: false }
  },

  insights: {
    dailyRecap: { type: Boolean, default: true },
    weeklyReport: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true }
  },

  productUpdates: {
    growthcraftNews: { type: Boolean, default: true }
  },

  newsletters: {
    socialMediaWeekly: { type: Boolean, default: true },
    openBlog: { type: Boolean, default: false }
  },

  research: {
    userFeedback: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model("NotificationSettings", notificationSettingsSchema);
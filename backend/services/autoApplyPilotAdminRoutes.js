const express = require("express");
const Package = require("../models/AutoApplyPackage");
const Send = require("../models/AutoApplySend");
const Feedback = require("../models/AutoApplyMatchFeedback");
const Tracker = require("../models/ApplicationTracker");
const Channel = require("../models/AutoApplyEmailChannel");
const { pilotUserIds, pilotLimits } = require("./autoApplyPilot");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const userIds = pilotUserIds();
    const [packages, sends, feedback, trackers] = await Promise.all([
      Package.find({ userId: { $in: userIds } }).select("userId companyId channelId status").lean(),
      Send.find({ userId: { $in: userIds }, isTest: false }).select("userId packageId channelId status providerMessageId acceptedAt lastErrorCode").lean(),
      Feedback.find({ userId: { $in: userIds } }).select("userId packageId positive reason").lean(),
      Tracker.find({ studentId: { $in: userIds }, sourceType: "auto_apply_email", isTest: false })
        .select("studentId autoApplyPackageId studentStatus").lean(),
    ]);
    const channelIds = [...new Set(packages.map((item) => String(item.channelId)))];
    const channels = await Channel.find({ _id: { $in: channelIds } })
      .select("company email verificationStatus channelType").lean();
    const channelMap = new Map(channels.map((item) => [String(item._id), item]));
    const rows = userIds.map((userId) => {
      const userPackages = packages.filter((item) => String(item.userId) === userId);
      const userSends = sends.filter((item) => String(item.userId) === userId);
      const userFeedback = feedback.filter((item) => String(item.userId) === userId);
      const userTrackers = trackers.filter((item) => String(item.studentId) === userId);
      return {
        userId,
        matched: userPackages.length,
        reviewed: userPackages.filter((item) => ["approved", "sent", "skipped"].includes(item.status)).length,
        sent: userSends.filter((item) => item.status === "accepted").length,
        skipped: userPackages.filter((item) => item.status === "skipped").length,
        feedback: {
          suitable: userFeedback.filter((item) => item.positive).length,
          unsuitable: userFeedback.filter((item) => !item.positive).length,
        },
        outcomes: {
          replies: userTrackers.filter((item) => ["contacted", "under_review"].includes(item.studentStatus)).length,
          interviews: userTrackers.filter((item) => item.studentStatus === "interview").length,
          acceptances: userTrackers.filter((item) => ["offer", "accepted"].includes(item.studentStatus)).length,
        },
        failures: userSends.filter((item) => item.status === "failed").length,
      };
    });
    const recent = sends.slice(-50).reverse().map((send) => {
      const item = packages.find((candidate) => String(candidate._id) === String(send.packageId));
      const channel = channelMap.get(String(send.channelId));
      return {
        userId: String(send.userId),
        packageId: send.packageId,
        company: channel?.company || "جهة تدريب",
        destination: channel?.email || "",
        verificationStatus: channel?.verificationStatus || "unknown",
        channelType: channel?.channelType || "unknown",
        providerStatus: send.status,
        acceptedAt: send.acceptedAt,
        errorCode: send.status === "failed" ? send.lastErrorCode : "",
      };
    });
    res.set("Cache-Control", "no-store").json({
      enabled: process.env.AUTO_APPLY_REAL_SEND_ENABLED === "true",
      allowlisted: userIds.length,
      limits: pilotLimits(),
      rows,
      recent,
    });
  } catch (error) {
    console.error("Auto Apply pilot monitor failed:", error.message);
    res.status(500).json({ error: "تعذر تحميل متابعة Pilot حاليًا." });
  }
});

module.exports = router;

const crypto = require("node:crypto");
const express = require("express");
const mongoose = require("mongoose");
const Profile = require("../models/AutoApplyProfile");
const Resume = require("../models/AutoApplyResume");
const Package = require("../models/AutoApplyPackage");
const Channel = require("../models/AutoApplyEmailChannel");
const Opportunity = require("../models/Opportunity");
const Tracker = require("../models/ApplicationTracker");
const Reward = require("../models/ExperienceResumeReward");
const RewardSnapshot = require("../models/ExperienceResumeSnapshot");
const ConnectedEmailAccount = require("../models/ConnectedEmailAccount");
const AutoApplySend = require("../models/AutoApplySend");
const AutoApplyDocument = require("../models/AutoApplyDocument");
const AutoApplyMatchFeedback = require("../models/AutoApplyMatchFeedback");
const AutoApplyPilotQuota = require("../models/AutoApplyPilotQuota");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");
const { FIELD_OPTIONS, COMMON_FIELDS, validateProfile, evaluateChannel, applicationMessage, isCurrentVerifiedChannel } = require("./autoApplyV1");
const { safeAccount } = require("./autoApplyGmailOAuth");
const { sendRealApplicationMessage } = require("./autoApplyGmailSend");
const { applicationDraft, selectedResumeAttachment } = require("./autoApplyPackageTestSend");
const { upsertAcceptedTracker, acceptProviderAndTrack } = require("./autoApplyPostSendTracking");
const { assertRealSendEnabled, pilotLimits } = require("./autoApplyPilot");
const { documentsSatisfied, assertReviewApproved, reserveSendSlot,
  releaseSendSlot } = require("./autoApplyPilotSend");

const router = express.Router();
const dryRun = () => process.env.AUTO_APPLY_DRY_RUN !== "false";
const safeError = (res, error) => res.status(error.status || 500).json({ error: error.status ? error.message : "تعذر إكمال الطلب حاليًا." });
const validId = (value) => mongoose.isValidObjectId(value);
const validPdf = (bytes) => Buffer.isBuffer(bytes) && bytes.length > 8 && bytes.length <= 5 * 1024 * 1024 &&
  bytes.subarray(0, 5).toString() === "%PDF-" && bytes.includes(Buffer.from("%%EOF"));

router.get("/me", async (req, res) => {
  try {
    const [profile, packages, emailAccount] = await Promise.all([
      Profile.findOne({ userId: req.autoApplyUser._id }).lean(),
      Package.find({ userId: req.autoApplyUser._id }).sort({ createdAt: -1 }).lean(),
      ConnectedEmailAccount.findOne({ userId: req.autoApplyUser._id, provider: "gmail" }).lean(),
    ]);
    const channelIds = packages.map((item) => item.channelId);
    const resumeIds = packages.map((item) => item.resumeSnapshotId);
    const [channels, resumes] = await Promise.all([
      Channel.find({ _id: { $in: channelIds } }).select("company email channelType").lean(),
      Resume.find({ _id: { $in: resumeIds }, userId: req.autoApplyUser._id }).select("filename sha256").lean(),
    ]);
    const channelById = new Map(channels.map((item) => [String(item._id), item]));
    const resumeById = new Map(resumes.map((item) => [String(item._id), item]));
    const safePackages = packages.map((item) => ({ ...item,
      company: channelById.get(String(item.channelId))?.company || "جهة تدريب",
      originalTargetEmail: channelById.get(String(item.channelId))?.email || "",
      channelType: channelById.get(String(item.channelId))?.channelType || "unknown",
      resumeFilename: resumeById.get(String(item.resumeSnapshotId))?.filename || "resume.pdf",
    }));
    const counts = Object.fromEntries(["ready_for_review", "approved", "sent", "needs_action", "skipped"].map((status) =>
      [status, packages.filter((item) => item.status === status).length]));
    const testMode = { enabled: false, recipient: "" };
    const limits = pilotLimits();
    res.json({ profile, packages: safePackages, counts, dryRun: dryRun(), fields: FIELD_OPTIONS,
      otherFields: COMMON_FIELDS, emailIdentity: safeAccount(emailAccount), testMode,
      pilot: { enabled: true, realSendEnabled: process.env.AUTO_APPLY_REAL_SEND_ENABLED === "true",
        firstSendConfirmed: Boolean(profile?.realSendConsentAt), limits } });
  } catch (error) { safeError(res, error); }
});

router.put("/profile", async (req, res) => {
  try {
    const fields = validateProfile(req.body);
    const existing = await Profile.findOne({ userId: req.autoApplyUser._id });
    if (req.body.resumeSnapshotId || req.body.resumeSource) {
      if (!validId(req.body.resumeSnapshotId)) return res.status(400).json({ error: "اختاري سيرة صالحة." });
      const asset = await Resume.findOne({ _id: req.body.resumeSnapshotId, userId: req.autoApplyUser._id }).select("source").lean();
      if (!asset || asset.source !== req.body.resumeSource) return res.status(403).json({ error: "السيرة غير متاحة لهذا الحساب." });
      fields.resumeSnapshotId = asset._id;
      fields.resumeSource = asset.source;
    } else if (existing?.resumeSnapshotId) {
      fields.resumeSnapshotId = existing.resumeSnapshotId;
      fields.resumeSource = existing.resumeSource;
    }
    const profile = await Profile.findOneAndUpdate({ userId: req.autoApplyUser._id }, { $set: fields }, { upsert: true, new: true, runValidators: true });
    res.json({ profile, dryRun: dryRun() });
  } catch (error) { safeError(res, error); }
});

router.get("/existing-resume", async (req, res) => {
  try {
    const reward = await Reward.findOne({ userId: req.autoApplyUser._id, status: "redeemed", resumeSnapshotId: { $ne: null } }).select("resumeSnapshotId").lean();
    const available = reward && await RewardSnapshot.exists({ _id: reward.resumeSnapshotId, userId: req.autoApplyUser._id, rewardId: reward._id });
    res.json({ rewardResumeAvailable: Boolean(available) });
  } catch (error) { safeError(res, error); }
});

router.post("/resume/from-reward", async (req, res) => {
  try {
    const reward = await Reward.findOne({ userId: req.autoApplyUser._id, status: "redeemed", resumeSnapshotId: { $ne: null } }).select("resumeSnapshotId").lean();
    if (!reward) return res.status(404).json({ error: "لا توجد سيرة مكافأة نهائية لهذا الحساب." });
    const snapshot = await RewardSnapshot.findOne({ _id: reward.resumeSnapshotId, rewardId: reward._id, userId: req.autoApplyUser._id }).select("pdf").lean();
    if (!validPdf(snapshot?.pdf)) return res.status(400).json({ error: "السيرة المحفوظة غير صالحة للاستخدام." });
    const asset = await Resume.create({ userId: req.autoApplyUser._id, source: "darbak_reward", filename: "darbak-resume.pdf",
      sha256: crypto.createHash("sha256").update(snapshot.pdf).digest("hex"), pdf: snapshot.pdf });
    res.status(201).json({ resumeSnapshotId: asset._id, resumeSource: asset.source });
  } catch (error) { safeError(res, error); }
});

router.post("/resume/upload", express.raw({ type: "application/pdf", limit: "5mb" }), async (req, res) => {
  try {
    if (!validPdf(req.body)) return res.status(400).json({ error: "ارفعي ملف PDF صالحًا بحجم لا يتجاوز 5MB." });
    // A paid Darbak resume is rendered in the existing client and copied here as
    // immutable bytes. This endpoint never writes to ResumeProfile.
    const source = req.get("x-auto-apply-resume-source") === "darbak_resume" ? "darbak_resume" : "uploaded";
    const asset = await Resume.create({ userId: req.autoApplyUser._id, source, filename: "resume.pdf",
      sha256: crypto.createHash("sha256").update(req.body).digest("hex"), pdf: req.body });
    res.status(201).json({ resumeSnapshotId: asset._id, resumeSource: asset.source });
  } catch (error) { safeError(res, error); }
});

router.get("/resume/:id/pdf", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const asset = await Resume.findOne({ _id: req.params.id, userId: req.autoApplyUser._id }).select("pdf sha256").lean();
    if (!asset || !validPdf(asset.pdf) || crypto.createHash("sha256").update(asset.pdf).digest("hex") !== asset.sha256) return res.sendStatus(404);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=auto-apply-resume.pdf", "Cache-Control": "private, no-store" });
    res.send(asset.pdf);
  } catch (error) { safeError(res, error); }
});

async function discover(userId, profile) {
  const now = new Date();
  const channels = await Channel.find({ verificationStatus: "verified", acceptsTrainingApplications: true,
    channelType: { $in: ["active_opportunity", "evergreen_training"] }, $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] }).lean();
  const activeIds = channels.filter((item) => item.channelType === "active_opportunity" && validId(item.activeOpportunityId)).map((item) => item.activeOpportunityId);
  const opportunities = await Opportunity.find({ _id: { $in: activeIds }, status: "active" }).lean();
  const byId = new Map(opportunities.map((item) => [String(item._id), item]));
  const tracked = await Tracker.find({ studentId: userId }).select("opportunityId companyName").lean();
  const applied = new Set(tracked.map((item) => String(item.opportunityId)).filter(Boolean));
  const appliedCompanies = new Set(tracked.map((item) => normalizeCompanyComparable(item.companyName)).filter(Boolean));
  const proposed = channels.flatMap((channel) => {
    const opportunity = channel.channelType === "active_opportunity" ? byId.get(String(channel.activeOpportunityId)) : null;
    if (channel.channelType === "active_opportunity" && !opportunity) return [];
    const result = evaluateChannel(profile, channel, opportunity,
      Boolean((opportunity && applied.has(String(opportunity._id))) || appliedCompanies.has(channel.companyNormalized)), now);
    if (!result || result.eligibility === "not_eligible") return [];
    const companyKey = String(channel.companyId || channel.companyNormalized || channel.company);
    const targetKey = `company:${companyKey}:${opportunity ? "active_opportunity" : "evergreen_training"}`;
    return [{ targetKey, companyKey, channelId: channel._id, companyId: channel.companyId || null, opportunityId: opportunity?._id || null,
      company: channel.company, title: opportunity?.title || "تقديم تدريب عام", cities: channel.cities || [], remote: channel.remote,
      applicationMethod: "email", channelType: channel.channelType, ...result }];
  }).sort((a, b) => (a.eligibility === "eligible" ? 0 : 1) - (b.eligibility === "eligible" ? 0 : 1) || a.company.localeCompare(b.company, "ar"));
  return [...new Map(proposed.map((item) => [item.targetKey, item])).values()];
}

router.get("/matches", async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.autoApplyUser._id }).lean();
    if (!profile) return res.json({ matches: [], dryRun: dryRun() });
    res.json({ matches: await discover(req.autoApplyUser._id, profile), dryRun: dryRun() });
  } catch (error) { safeError(res, error); }
});

router.post("/packages/sync", async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.autoApplyUser._id }).lean();
    if (!profile?.resumeSnapshotId) return res.status(400).json({ error: "اختاري سيرتك الأساسية أولًا." });
    const [asset, documents] = await Promise.all([
      Resume.findOne({ _id: profile.resumeSnapshotId, userId: req.autoApplyUser._id }).select("_id").lean(),
      AutoApplyDocument.find({ userId: req.autoApplyUser._id }).lean(),
    ]);
    if (!asset) return res.status(400).json({ error: "السيرة المختارة غير متاحة." });
    const matches = await discover(req.autoApplyUser._id, profile);
    const created = [];
    for (const match of matches) {
      const channel = await Channel.findById(match.channelId).lean();
      if (!isCurrentVerifiedChannel(channel)) continue;
      const opportunity = match.opportunityId ? await Opportunity.findById(match.opportunityId).lean() : null;
      const message = applicationMessage({ profile, channel, opportunity, studentName: req.autoApplyUser.firstName });
      const documentState = documentsSatisfied({ channel, resume: asset, documents });
      const record = await Package.findOneAndUpdate({ userId: req.autoApplyUser._id, targetKey: match.targetKey },
        { $setOnInsert: { userId: req.autoApplyUser._id, targetKey: match.targetKey, companyKey: match.companyKey, companyId: match.companyId,
          channelId: match.channelId, opportunityId: match.opportunityId, resumeSnapshotId: profile.resumeSnapshotId,
          subject: message.subject, body: message.body, matchedFields: match.matchedFields,
          matchReasons: match.reasons, blockers: match.blockers, eligibility: match.eligibility,
          matchConfidence: match.matchConfidence,
          status: match.eligibility === "eligible" && documentState.ok ? "ready_for_review" : "needs_action" } },
        { upsert: true, new: true, runValidators: true });
      created.push(record);
    }
    res.json({ packages: created, dryRun: dryRun(), sent: 0 });
  } catch (error) { safeError(res, error); }
});

router.patch("/packages/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const action = req.body?.action;
    if (!["approve", "skip", "exclude", "edit"].includes(action)) return res.status(400).json({ error: "إجراء غير صالح." });
    const item = await Package.findOne({ _id: req.params.id, userId: req.autoApplyUser._id });
    if (!item) return res.sendStatus(404);
    if (["sent", "skipped"].includes(item.status)) return res.status(409).json({ error: "لا يمكن تعديل هذه الحالة." });
    if (action === "approve" && item.eligibility !== "eligible") return res.status(400).json({ error: "راجعي شروط الأهلية أولًا." });
    if (action === "approve") {
      const [channel, resume, documents] = await Promise.all([
        Channel.findById(item.channelId).lean(),
        Resume.findOne({ _id: item.resumeSnapshotId, userId: req.autoApplyUser._id }).select("_id").lean(),
        AutoApplyDocument.find({ userId: req.autoApplyUser._id }).lean(),
      ]);
      const documentState = documentsSatisfied({ channel, resume, documents });
      if (!documentState.ok) return res.status(409).json({
        error: "أضيفي المستند المطلوب قبل اعتماد التقديم.",
        missingDocuments: documentState.missing,
      });
    }
    if (action === "approve") item.status = "approved";
    if (action === "skip" || action === "exclude") item.status = "skipped";
    if (action === "edit" || (action === "approve" && req.body?.subject && req.body?.body)) {
      const subject = String(req.body?.subject || "").trim(), body = String(req.body?.body || "").trim();
      if (!subject || !body || subject.length > 300 || body.length > 5000) return res.status(400).json({ error: "الرسالة غير صالحة." });
      item.subject = subject; item.body = body;
    }
    await item.save();
    if (action === "exclude") {
      const companyKey = item.companyKey;
      if (companyKey) await Profile.updateOne({ userId: req.autoApplyUser._id }, { $addToSet: { excludedCompanyIds: companyKey } });
    }
    res.json({ package: item, dryRun: dryRun(), sent: 0 });
  } catch (error) { safeError(res, error); }
});

router.post("/pilot/confirm-real-send", async (req, res) => {
  try {
    if (req.body?.confirm !== "REVIEWED_REAL_COMPANY_SEND") {
      return res.status(400).json({ error: "راجعي التنبيه وأكدي قبل أول إرسال." });
    }
    assertRealSendEnabled({ userId: req.autoApplyUser._id });
    const profile = await Profile.findOneAndUpdate(
      { userId: req.autoApplyUser._id },
      { $set: { realSendConsentAt: new Date(), mode: "review_first" } },
      { new: true },
    );
    if (!profile) return res.status(409).json({ error: "أكملي ملف التقديم أولًا." });
    res.json({ firstSendConfirmed: true, confirmedAt: profile.realSendConsentAt });
  } catch (error) { safeError(res, error); }
});

router.post("/packages/:id/send", async (req, res) => {
  let reservation = null;
  let quotaReservation = null;
  try {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const limits = assertRealSendEnabled({ userId: req.autoApplyUser._id });
    const item = await Package.findOne({ _id: req.params.id, userId: req.autoApplyUser._id });
    if (!item) return res.sendStatus(404);
    const [channel, asset, account, opportunity, profile, documents] = await Promise.all([
      Channel.findById(item.channelId).lean(),
      Resume.findOne({ _id: item.resumeSnapshotId, userId: req.autoApplyUser._id }).select("filename sha256 pdf").lean(),
      ConnectedEmailAccount.findOne({ userId: req.autoApplyUser._id, provider: "gmail" }).select("+encryptedRefreshToken"),
      item.opportunityId ? Opportunity.findById(item.opportunityId).lean() : null,
      Profile.findOne({ userId: req.autoApplyUser._id }).lean(),
      AutoApplyDocument.find({ userId: req.autoApplyUser._id }).lean(),
    ]);
    const documentState = documentsSatisfied({ channel, resume: asset, documents });
    assertReviewApproved({ item, channel, documentState, profile });
    if (!account || account.status !== "connected") {
      return res.status(409).json({ error: "اربط Gmail أولًا." });
    }
    const draft = applicationDraft(req.body);
    const attachment = selectedResumeAttachment(asset);
    const accepted = await AutoApplySend.findOne({ userId: req.autoApplyUser._id, packageId: item._id, status: "accepted" });
    if (accepted) return res.status(409).json({ error: "تم إرسال هذا التقديم مسبقًا." });
    const hashes = {
      resumeSha256: attachment.sha256,
      subjectSha256: crypto.createHash("sha256").update(draft.subject).digest("hex"),
      bodySha256: crypto.createHash("sha256").update(draft.body).digest("hex"),
    };
    reservation = await AutoApplySend.findOneAndUpdate(
      { userId: req.autoApplyUser._id, packageId: item._id, status: "failed" },
      { $set: { status: "pending", lastErrorCode: "", actualRecipient: channel.email,
        originalTargetEmail: channel.email, senderEmail: account.emailAddress,
        resumeSnapshotId: item.resumeSnapshotId, filename: attachment.filename, ...hashes },
      $inc: { attemptCount: 1 } },
      { new: true },
    );
    if (!reservation) {
      reservation = await AutoApplySend.create({ userId: req.autoApplyUser._id, packageId: item._id,
        companyId: item.companyId, opportunityId: item.opportunityId, channelId: item.channelId,
        resumeSnapshotId: item.resumeSnapshotId, originalTargetEmail: channel.email,
        actualRecipient: channel.email, senderEmail: account.emailAddress,
        filename: attachment.filename, ...hashes, status: "pending", isTest: false });
    }
    quotaReservation = await reserveSendSlot({ QuotaModel: AutoApplyPilotQuota,
      userId: req.autoApplyUser._id, limits });
    const result = await acceptProviderAndTrack({
      sendProvider: () => sendRealApplicationMessage({ account, recipient: channel.email,
        subject: draft.subject, body: draft.body, attachment,
        authorization: "pilot-review-approved" }),
      markAccepted: async ({ providerMessageId, acceptedAt }) => {
        reservation = await AutoApplySend.findByIdAndUpdate(reservation._id,
          { $set: { status: "accepted", providerMessageId, acceptedAt, lastErrorCode: "" } }, { new: true });
        await Package.updateOne({ _id: item._id, userId: req.autoApplyUser._id }, { $set: { status: "sent" } });
        return reservation;
      },
      createTracker: ({ send, acceptedAt }) => upsertAcceptedTracker({ Tracker,
        user: req.autoApplyUser, item, channel, opportunity, send, now: acceptedAt, isTest: false }),
    });
    res.status(201).json({ ok: true, providerMessageId: result.providerMessageId,
      senderEmail: account.emailAddress, recipient: channel.email, sentAt: result.acceptedAt,
      message: "تم التقديم ✓" });
  } catch (error) {
    if (reservation?.status === "pending") {
      await AutoApplySend.updateOne({ _id: reservation._id, status: "pending" },
        { $set: { status: "failed", lastErrorCode: String(error.message || "GMAIL_SEND_FAILED").slice(0, 100) } }).catch(() => {});
      await releaseSendSlot({ QuotaModel: AutoApplyPilotQuota,
        userId: req.autoApplyUser._id, reservation: quotaReservation });
    }
    if (error?.code === 11000) return res.status(409).json({ error: "الإرسال قيد التنفيذ أو اكتمل مسبقًا." });
    const safe = {
      AUTO_APPLY_REAL_SEND_DISABLED: "التقديم الحقيقي متوقف حاليًا.",
      AUTO_APPLY_PILOT_NOT_ALLOWED: "هذه التجربة متاحة للمجموعة التجريبية فقط.",
      AUTO_APPLY_REVIEW_NOT_APPROVED: "اعتمدي الرسالة أولًا قبل الإرسال.",
      AUTO_APPLY_FIRST_SEND_CONFIRMATION_REQUIRED: "أكدي تنبيه الإرسال الحقيقي أولًا.",
      AUTO_APPLY_CHANNEL_NOT_VERIFIED: "قناة التقديم غير مؤهلة للإرسال.",
      AUTO_APPLY_REQUIRED_DOCUMENT_MISSING: "أضيفي المستند المطلوب قبل الإرسال.",
      AUTO_APPLY_PILOT_SEND_LIMIT_REACHED: "وصلتِ للحد التجريبي المسموح.",
      GMAIL_NOT_CONNECTED: "اربط Gmail أولًا.",
    };
    if (safe[error.message]) return res.status(error.status || 409).json({ error: safe[error.message] });
    console.error("Auto Apply pilot send failed:", error.message, error.providerStatus || "");
    return res.status(error.status || 502).json({ error: "تعذر إرسال الطلب حاليًا، ويمكن المحاولة لاحقًا." });
  }
});

router.post("/packages/:id/feedback", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const item = await Package.findOne({ _id: req.params.id, userId: req.autoApplyUser._id }).lean();
    if (!item) return res.sendStatus(404);
    const positive = req.body?.positive === true;
    const allowedReasons = ["major", "field", "city", "documents", "company", "other"];
    const reason = positive ? "" : String(req.body?.reason || "");
    if (!positive && !allowedReasons.includes(reason)) return res.status(400).json({ error: "اختاري سببًا مختصرًا." });
    await AutoApplyMatchFeedback.findOneAndUpdate(
      { userId: req.autoApplyUser._id, packageId: item._id },
      { $set: { companyId: item.companyId, positive, reason } },
      { upsert: true, new: true, runValidators: true },
    );
    res.json({ saved: true });
  } catch (error) { safeError(res, error); }
});

module.exports = router;

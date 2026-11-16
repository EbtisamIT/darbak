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
const AutoApplyOAuthState = require("../models/AutoApplyOAuthState");
const AutoApplyGmailTestSend = require("../models/AutoApplyGmailTestSend");
const AutoApplyGmailPdfTestSend = require("../models/AutoApplyGmailPdfTestSend");
const AutoApplySend = require("../models/AutoApplySend");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");
const { FIELD_OPTIONS, COMMON_FIELDS, validateProfile, evaluateChannel, applicationMessage, isCurrentVerifiedChannel } = require("./autoApplyV1");
const { requiredConfig, stateHash, authorizationUrl, safeAccount } = require("./autoApplyGmailOAuth");
const { claimGmailLink } = require("./autoApplyGmailCallback");
const { PDF_TEST_SUBJECT, PDF_TEST_BODY, assertTestSendAllowed, sendTestMessage } = require("./autoApplyGmailSend");
const { createAutoApplyTestPdf } = require("../fixtures/autoApplyTestPdf");
const { testRecipientOverride, applicationDraft, selectedResumeAttachment,
  assertCompanyRecipientBlocked } = require("./autoApplyPackageTestSend");
const { upsertAcceptedTracker, acceptProviderAndTrack } = require("./autoApplyPostSendTracking");

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
    let testMode = { enabled: false, recipient: "" };
    try { testMode = { enabled: true, recipient: testRecipientOverride() }; } catch {}
    res.json({ profile, packages: safePackages, counts, dryRun: dryRun(), fields: FIELD_OPTIONS,
      otherFields: COMMON_FIELDS, emailIdentity: safeAccount(emailAccount), testMode });
  } catch (error) { safeError(res, error); }
});

router.get("/email/gmail/connect", async (req, res) => {
  try {
    if (!req.autoApplyUser?._id) return res.status(401).json({ error: "سجّل الدخول أولًا." });
    const config = requiredConfig();
    const state = crypto.randomBytes(32).toString("base64url");
    await AutoApplyOAuthState.create({ userId: req.autoApplyUser._id, provider: "gmail", stateHash: stateHash(state),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    res.set("Cache-Control", "no-store").json({ authorizationUrl: authorizationUrl({ state, config }) });
  } catch (error) { safeError(res, error); }
});

const GMAIL_LINK_ERRORS = {
  GMAIL_LINK_INVALID: "انتهت صلاحية ربط Gmail أو استُخدم من قبل. ابدأ الربط من جديد.",
  GMAIL_LINK_ACCOUNT_MISMATCH: "بدأ ربط Gmail من حساب دربك مختلف، فلم نربطه بحسابك. ابدأ الربط من حسابك أنت.",
};

// Completes a Gmail link only for the Darbak account that started it.
router.post("/email/gmail/complete", async (req, res) => {
  try {
    if (!req.autoApplyUser?._id) return res.status(401).json({ error: "سجّل الدخول أولًا." });
    const result = await claimGmailLink({ linkCode: req.body?.linkCode, userId: req.autoApplyUser._id });
    res.set("Cache-Control", "no-store").json({ provider: "gmail", connectionStatus: "connected",
      emailAddress: result.emailAddress });
  } catch (error) {
    if (GMAIL_LINK_ERRORS[error.message]) return res.status(error.status).json({ error: GMAIL_LINK_ERRORS[error.message] });
    safeError(res, error);
  }
});

router.get("/email/status", async (req, res) => {
  try {
    if (!req.autoApplyUser?._id) return res.status(401).json({ error: "سجّل الدخول أولًا." });
    const account = await ConnectedEmailAccount.findOne({ userId: req.autoApplyUser._id, provider: "gmail" }).lean();
    res.set("Cache-Control", "no-store").json(safeAccount(account));
  } catch (error) { safeError(res, error); }
});

router.delete("/email/gmail", async (req, res) => {
  try {
    if (!req.autoApplyUser?._id) return res.status(401).json({ error: "سجّل الدخول أولًا." });
    await ConnectedEmailAccount.findOneAndDelete({ userId: req.autoApplyUser._id, provider: "gmail" });
    res.json({ provider: "gmail", connectionStatus: "not_connected", emailAddress: "" });
  } catch (error) { safeError(res, error); }
});

router.post("/email/gmail/test-send", async (req, res) => {
  let reservation = null;
  try {
    if (!req.autoApplyUser?._id) return res.status(401).json({ error: "سجّل الدخول أولًا." });
    const recipient = assertTestSendAllowed({ recipient: req.body?.recipient });
    const account = await ConnectedEmailAccount.findOne({ userId: req.autoApplyUser._id, provider: "gmail" })
      .select("+encryptedRefreshToken");
    if (!account || account.status !== "connected") return res.status(409).json({ error: "اربط Gmail أولًا." });
    reservation = await AutoApplyGmailTestSend.create({ userId: req.autoApplyUser._id, recipient, status: "pending" });
    const result = await sendTestMessage({ account, recipient });
    reservation.status = "sent";
    reservation.providerMessageId = result.providerMessageId;
    reservation.sentAt = new Date();
    await reservation.save();
    res.status(201).json({ ok: true, providerMessageId: result.providerMessageId });
  } catch (error) {
    if (reservation && reservation.status === "pending") {
      reservation.status = "failed";
      await reservation.save().catch(() => {});
    }
    if (error?.code === 11000) return res.status(409).json({ error: "تم تنفيذ رسالة الاختبار لهذا الحساب مسبقًا." });
    const known = ["GMAIL_TEST_SEND_DISABLED", "GMAIL_TEST_RECIPIENT_NOT_ALLOWED", "GMAIL_NOT_CONNECTED"];
    if (known.includes(error.message)) return res.status(error.status || 400).json({ error: "تعذر تنفيذ رسالة الاختبار." });
    console.error("Auto Apply Gmail test send failed:", error.message, error.providerStatus || "");
    return res.status(error.status || 502).json({ error: "تعذر إرسال رسالة الاختبار حاليًا." });
  }
});

router.post("/email/gmail/test-send-pdf", async (req, res) => {
  let reservation = null;
  try {
    if (!req.autoApplyUser?._id) return res.status(401).json({ error: "سجّل الدخول أولًا." });
    const recipient = assertTestSendAllowed({ recipient: req.body?.recipient });
    const account = await ConnectedEmailAccount.findOne({ userId: req.autoApplyUser._id, provider: "gmail" })
      .select("+encryptedRefreshToken");
    if (!account || account.status !== "connected") return res.status(409).json({ error: "اربط Gmail أولًا." });
    const bytes = createAutoApplyTestPdf();
    const attachment = { filename: "darbak-auto-apply-test.pdf", mimeType: "application/pdf", bytes };
    reservation = await AutoApplyGmailPdfTestSend.create({ userId: req.autoApplyUser._id, recipient,
      filename: attachment.filename, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), status: "pending" });
    const result = await sendTestMessage({ account, recipient, subject: PDF_TEST_SUBJECT,
      body: PDF_TEST_BODY, attachment });
    reservation.status = "sent";
    reservation.providerMessageId = result.providerMessageId;
    reservation.sentAt = new Date();
    await reservation.save();
    res.status(201).json({ ok: true, providerMessageId: result.providerMessageId,
      filename: attachment.filename, attachmentSha256: reservation.sha256 });
  } catch (error) {
    if (reservation && reservation.status === "pending") {
      reservation.status = "failed";
      await reservation.save().catch(() => {});
    }
    if (error?.code === 11000) return res.status(409).json({ error: "تم تنفيذ اختبار مرفق PDF لهذا الحساب مسبقًا." });
    const known = ["GMAIL_TEST_SEND_DISABLED", "GMAIL_TEST_RECIPIENT_NOT_ALLOWED", "GMAIL_NOT_CONNECTED",
      "GMAIL_TEST_ATTACHMENT_MISSING", "GMAIL_TEST_ATTACHMENT_EMPTY", "GMAIL_TEST_ATTACHMENT_TOO_LARGE",
      "GMAIL_TEST_ATTACHMENT_NOT_PDF", "GMAIL_TEST_ATTACHMENT_FILENAME_INVALID"];
    if (known.includes(error.message)) return res.status(error.status || 400).json({ error: "تعذر تنفيذ اختبار مرفق PDF." });
    console.error("Auto Apply Gmail PDF test send failed:", error.message, error.providerStatus || "");
    return res.status(error.status || 502).json({ error: "تعذر إرسال رسالة اختبار المرفق حاليًا." });
  }
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
    const asset = await Resume.exists({ _id: profile.resumeSnapshotId, userId: req.autoApplyUser._id });
    if (!asset) return res.status(400).json({ error: "السيرة المختارة غير متاحة." });
    const matches = await discover(req.autoApplyUser._id, profile);
    const created = [];
    for (const match of matches) {
      const channel = await Channel.findById(match.channelId).lean();
      if (!isCurrentVerifiedChannel(channel)) continue;
      const opportunity = match.opportunityId ? await Opportunity.findById(match.opportunityId).lean() : null;
      const message = applicationMessage({ profile, channel, opportunity, studentName: req.autoApplyUser.firstName });
      const record = await Package.findOneAndUpdate({ userId: req.autoApplyUser._id, targetKey: match.targetKey },
        { $setOnInsert: { userId: req.autoApplyUser._id, targetKey: match.targetKey, companyKey: match.companyKey, companyId: match.companyId,
          channelId: match.channelId, opportunityId: match.opportunityId, resumeSnapshotId: profile.resumeSnapshotId,
          subject: message.subject, body: message.body, matchedFields: match.matchedFields,
          matchReasons: match.reasons, blockers: match.blockers, eligibility: match.eligibility,
          matchConfidence: match.matchConfidence, status: match.eligibility === "eligible" ? "ready_for_review" : "needs_action" } },
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

router.post("/packages/:id/test-send", async (req, res) => {
  let reservation = null;
  try {
    if (!validId(req.params.id)) return res.sendStatus(404);
    const testRecipient = testRecipientOverride();
    const item = await Package.findOne({ _id: req.params.id, userId: req.autoApplyUser._id });
    if (!item) return res.sendStatus(404);
    if (item.eligibility !== "eligible" || !["ready_for_review", "approved"].includes(item.status)) {
      return res.status(409).json({ error: "هذه المسودة غير جاهزة لاختبار الإرسال." });
    }
    const [channel, asset, account, opportunity] = await Promise.all([
      Channel.findById(item.channelId).lean(),
      Resume.findOne({ _id: item.resumeSnapshotId, userId: req.autoApplyUser._id }).select("filename sha256 pdf").lean(),
      ConnectedEmailAccount.findOne({ userId: req.autoApplyUser._id, provider: "gmail" }).select("+encryptedRefreshToken"),
      item.opportunityId ? Opportunity.findById(item.opportunityId).lean() : null,
    ]);
    if (!isCurrentVerifiedChannel(channel)) return res.status(409).json({ error: "قناة التقديم لم تعد جاهزة." });
    if (!account || account.status !== "connected") return res.status(409).json({ error: "اربط Gmail أولًا." });
    assertCompanyRecipientBlocked(channel.email, testRecipient);
    const draft = applicationDraft(req.body);
    const attachment = selectedResumeAttachment(asset);
    item.subject = draft.subject;
    item.body = draft.body;
    item.status = "approved";
    await item.save();

    reservation = await AutoApplySend.findOne({ userId: req.autoApplyUser._id, packageId: item._id });
    if (reservation?.status === "accepted") {
      await upsertAcceptedTracker({ Tracker, user: req.autoApplyUser, item, channel, opportunity,
        send: reservation, now: reservation.acceptedAt });
      return res.status(200).json({ ok: true, alreadyAccepted: true,
        providerMessageId: reservation.providerMessageId, senderEmail: reservation.senderEmail,
        testRecipient: reservation.actualRecipient, sentAt: reservation.acceptedAt,
        filename: reservation.filename, message: "تم تسجيل النسخة التجريبية مسبقًا دون إرسال جديد." });
    }
    if (reservation?.status === "pending") {
      return res.status(409).json({ error: "اختبار الإرسال قيد التنفيذ." });
    }
    const hashes = { resumeSha256: attachment.sha256,
      subjectSha256: crypto.createHash("sha256").update(draft.subject).digest("hex"),
      bodySha256: crypto.createHash("sha256").update(draft.body).digest("hex") };
    if (reservation) {
      const claimed = await AutoApplySend.findOneAndUpdate(
        { _id: reservation._id, status: "failed" },
        { $set: { status: "pending", lastErrorCode: "", actualRecipient: testRecipient, originalTargetEmail: channel.email,
          senderEmail: account.emailAddress, resumeSnapshotId: item.resumeSnapshotId, filename: attachment.filename, ...hashes },
        $inc: { attemptCount: 1 } }, { new: true });
      if (!claimed) return res.status(409).json({ error: "اختبار الإرسال قيد التنفيذ." });
      reservation = claimed;
    } else {
      reservation = await AutoApplySend.create({ userId: req.autoApplyUser._id, packageId: item._id,
        companyId: item.companyId, opportunityId: item.opportunityId, channelId: item.channelId,
        resumeSnapshotId: item.resumeSnapshotId, originalTargetEmail: channel.email,
        actualRecipient: testRecipient, senderEmail: account.emailAddress,
        filename: attachment.filename, ...hashes, status: "pending", isTest: true });
    }
    const result = await acceptProviderAndTrack({
      sendProvider: () => sendTestMessage({ account, recipient: testRecipient, subject: draft.subject,
        body: draft.body, attachment }),
      markAccepted: async ({ providerMessageId, acceptedAt }) => {
        reservation = await AutoApplySend.findByIdAndUpdate(reservation._id,
          { $set: { status: "accepted", providerMessageId, acceptedAt, lastErrorCode: "" } }, { new: true });
        return reservation;
      },
      createTracker: ({ send, acceptedAt }) => upsertAcceptedTracker({ Tracker, user: req.autoApplyUser,
        item, channel, opportunity, send, now: acceptedAt }),
    });
    res.status(201).json({ ok: true, providerMessageId: result.providerMessageId,
      senderEmail: account.emailAddress, testRecipient, sentAt: result.acceptedAt,
      filename: attachment.filename, message: "تم إرسال النسخة التجريبية بنجاح ✓\nلم يتم التواصل مع الجهة." });
  } catch (error) {
    if (reservation?.status === "pending") {
      reservation.status = "failed";
      reservation.lastErrorCode = String(error.message || "GMAIL_TEST_SEND_FAILED").slice(0, 100);
      await reservation.save().catch(() => {});
    }
    if (error?.code === 11000) return res.status(409).json({ error: "اختبار الإرسال قيد التنفيذ أو اكتمل." });
    const known = ["GMAIL_TEST_SEND_DISABLED", "GMAIL_TEST_RECIPIENT_NOT_ALLOWED",
      "GMAIL_TEST_RECIPIENT_NOT_CONFIGURED", "AUTO_APPLY_TEST_DRAFT_INVALID",
      "AUTO_APPLY_TEST_RESUME_INVALID", "AUTO_APPLY_TEST_DESTINATION_UNSAFE"];
    if (known.includes(error.message)) return res.status(error.status || 400).json({ error: "تعذر تنفيذ اختبار الإرسال بأمان." });
    console.error("Auto Apply package test send failed:", error.message, error.providerStatus || "");
    return res.status(error.status || 502).json({ error: "تعذر إرسال النسخة التجريبية حاليًا، ويمكن المحاولة لاحقًا." });
  }
});

module.exports = router;

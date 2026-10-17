// Temporary QA-only maintenance. Remove this file and its route before rollout.
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const User = require("../models/User");
const Experience = require("../models/Experience");
const InterviewQuestion = require("../models/InterviewQuestion");
const Reward = require("../models/ExperienceResumeReward");
const Snapshot = require("../models/ExperienceResumeSnapshot");
const ResumeProfile = require("../models/ResumeProfile");
const Subscription = require("../models/Subscription");
const ResumeAgentSession = require("../models/ResumeAgentSession");
const { CAMPAIGN_ID } = require("./experienceResumeReward");

const QA = Object.freeze({
  contact: "qa-resume-c8627f9d-20260930@example.invalid",
  organization: "QA Test - جهة تدريب تجريبية",
  city: "الرياض",
  major: "تقنية المعلومات",
  description: "QA Test فقط: هذه تجربة تدريب تجريبية لا تمثل جهة حقيقية. ساهمت في توثيق متطلبات مشروع داخلي، تنظيم البيانات، وتجربة أدوات التحليل ضمن دورة اختبار دربك.",
  interviewQuestion: "QA Test فقط: ما خطوات توثيق متطلبات مشروع داخلي؟",
  interviewNote: "QA Test - مقابلة تجريبية لا تمثل جهة حقيقية.",
});

const ID_KEYS = ["userId", "experienceId", "interviewId", "rewardId"];
const isExactId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const parseIds = (body = {}) => {
  assert(ID_KEYS.every((key) => isExactId(body[key])), "Four exact QA ObjectIds are required");
  assert(!Object.prototype.hasOwnProperty.call(body, "snapshotId"), "SnapshotId must come from the reward");
  return Object.fromEntries(ID_KEYS.map((key) => [key, new mongoose.Types.ObjectId(body[key])]));
};

const assertQaRecords = ({ ids, user, experience, interview, reward, snapshots }, stage) => {
  assert(user && experience && interview && reward, "Exact QA record is missing");
  assert.equal(user.contact, QA.contact, "QA account marker differs");
  assert.equal(String(user._id), String(process.env.EXPERIENCE_REWARD_QA_USER_ID || "6abd577bec30b3276baf2027"), "Not the configured QA user");
  assert.equal(String(experience.submittedByUserId), String(user._id), "Experience owner differs");
  assert.equal(experience.organizationName, QA.organization);
  assert.equal(experience.city, QA.city);
  assert.equal(experience.major, QA.major);
  assert.equal(experience.description, QA.description);
  assert.equal(experience.status, "approved", "QA experience is not approved");
  assert.equal(interview.organizationName, QA.organization);
  assert.equal(interview.city, QA.city);
  assert.equal(interview.major, QA.major);
  assert.deepEqual(interview.questions, [QA.interviewQuestion]);
  assert.equal(interview.note, QA.interviewNote);
  // InterviewQuestion has no experience/user foreign key. Require exact ID,
  // unique QA content, matching context, and a close submission timestamp.
  assert(Math.abs(new Date(interview.createdAt) - new Date(experience.createdAt)) < 60 * 60 * 1000,
    "Interview cannot be associated safely with this QA experience");
  assert.equal(String(reward.userId), String(user._id));
  assert.equal(String(reward.experienceId), String(experience._id));
  assert.equal(reward.campaignId, CAMPAIGN_ID);
  assert.equal(reward.type, "single_ats_resume");
  assert(["available", "redeemed"].includes(reward.status));
  assert(snapshots.length <= 1, "Duplicate snapshot found");
  for (const snapshot of snapshots) {
    assert.equal(String(snapshot.userId), String(user._id));
    assert.equal(String(snapshot.rewardId), String(reward._id));
  }
  if (reward.status === "available") {
    assert.equal(snapshots.length, 0, "Available reward has a snapshot");
    assert(reward.resumeSnapshotId == null, "Available reward has a snapshot link");
  } else {
    assert.equal(snapshots.length, 1, "Redeemed reward must have one snapshot");
    assert.equal(String(reward.resumeSnapshotId), String(snapshots[0]._id));
  }
  if (stage === "pre_finalize") assert.equal(reward.status, "available", "Pre-finalize reward must be available");
  if (stage === "post_finalize") assert.equal(reward.status, "redeemed", "Post-finalize reward must be redeemed");
};

const getPdfCount = (snapshots) => snapshots.filter((item) => {
  const pdf = item.pdf;
  return Buffer.isBuffer(pdf) ? pdf.length > 0 : Boolean(pdf?.buffer?.length);
}).length;

async function loadExact(ids, stage, session) {
  const options = session ? { session } : {};
  const [user, experience, interview, reward] = await Promise.all([
    User.findOne({ _id: ids.userId, contact: QA.contact }, null, options).lean(),
    Experience.findOne({ _id: ids.experienceId, submittedByUserId: ids.userId }, null, options).lean(),
    InterviewQuestion.findOne({ _id: ids.interviewId }, null, options).lean(),
    Reward.findOne({ _id: ids.rewardId, userId: ids.userId, experienceId: ids.experienceId, campaignId: CAMPAIGN_ID }, null, options).lean(),
  ]);
  assert(reward, "Exact QA reward is missing");
  const snapshotCount = await Snapshot.countDocuments({ rewardId: reward._id, userId: ids.userId }).session(session || null);
  assert(snapshotCount <= 1, "Duplicate snapshot found");
  const snapshot = reward.resumeSnapshotId
    ? await Snapshot.findOne({ _id: reward.resumeSnapshotId, rewardId: reward._id, userId: ids.userId }, null, options).lean()
    : null;
  const snapshots = snapshot ? [snapshot] : [];
  assert.equal(snapshotCount, snapshots.length, "Snapshot is not linked through the reward");
  const records = { ids, user, experience, interview, reward, snapshots };
  assertQaRecords(records, stage);
  assert.equal(await Reward.countDocuments({ userId: ids.userId, campaignId: CAMPAIGN_ID }).session(session || null), 1,
    "QA campaign reward count must equal one");
  assert.equal(await Experience.countDocuments({ submittedByUserId: ids.userId,
    organizationName: QA.organization, description: QA.description }).session(session || null), 1,
  "QA experience marker must be unique");
  assert.equal(await InterviewQuestion.countDocuments({ organizationName: QA.organization,
    note: QA.interviewNote, questions: QA.interviewQuestion }).session(session || null), 1,
  "QA interview marker must be unique");
  return records;
}

async function isolationCounts(records) {
  const since = records.experience.createdAt;
  const [profiles, subscriptions, agentSessions] = await Promise.all([
    ResumeProfile.countDocuments({ $and: [
      { $or: [{ userId: records.ids.userId }, { contact: QA.contact }] },
      { $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }] },
    ] }),
    Subscription.countDocuments({ email: QA.contact, createdAt: { $gte: since } }),
    ResumeAgentSession.countDocuments({ $or: [{ userId: records.ids.userId }, { contact: QA.contact }],
      createdAt: { $gte: since } }),
  ]);
  return { resumeProfileCreatedOrUpdatedSinceQa: profiles,
    resumeSubscriptionCreatedSinceQa: subscriptions,
    agentSessionsCreatedSinceQa: agentSessions,
    userResumeEntitlement: (records.user.entitlements || []).includes("resume_builder"),
    userAccessSource: records.user.accessSource || "" };
}

const summary = (records, isolation) => ({
  counts: { experience: 1, interview: 1, reward: 1, snapshot: records.snapshots.length,
    pdf: getPdfCount(records.snapshots) },
  experienceStatus: records.experience.status,
  rewardStatus: records.reward.status,
  snapshotIds: records.snapshots.map((item) => String(item._id)),
  pdfReferenceCount: getPdfCount(records.snapshots),
  isolation,
});

async function runQaMaintenance(body) {
  const ids = parseIds(body);
  const action = body.action;
  assert(["verify", "cleanup-preview", "cleanup"].includes(action), "Invalid action");
  const stage = action === "verify" ? body.stage : "post_finalize";
  if (action === "verify") assert(["pre_finalize", "post_finalize"].includes(stage), "Invalid verify stage");
  if (action === "verify") {
    const user = await User.findOne({ _id: ids.userId, contact: QA.contact }).select("_id").lean();
    assert(user, "Not the QA account");
    const remaining = await Promise.all([
      Experience.countDocuments({ _id: ids.experienceId }),
      InterviewQuestion.countDocuments({ _id: ids.interviewId }),
      Reward.countDocuments({ _id: ids.rewardId }),
      Snapshot.countDocuments({ rewardId: ids.rewardId }),
    ]);
    if (remaining.every((count) => count === 0)) {
      return { counts: { experience: 0, interview: 0, reward: 0, snapshot: 0, pdf: 0 },
        rewardStatus: null, snapshotIds: [], pdfReferenceCount: 0, state: "absent" };
    }
  }
  const records = await loadExact(ids, stage);
  const isolation = await isolationCounts(records);
  const state = summary(records, isolation);
  if (action === "verify") return state;
  assert.equal(records.reward.status, "redeemed", "Cleanup requires a redeemed reward");
  assert.equal(records.snapshots.length, 1, "Cleanup requires one snapshot");
  assert.equal(state.counts.pdf, 1, "Cleanup requires one PDF");
  const snapshotId = records.reward.resumeSnapshotId;
  assert(snapshotId, "Cleanup requires reward-linked snapshotId");
  assert.equal(isolation.resumeProfileCreatedOrUpdatedSinceQa, 0, "ResumeProfile changed during QA");
  assert.equal(isolation.resumeSubscriptionCreatedSinceQa, 0, "Subscription created during QA");
  assert.equal(isolation.agentSessionsCreatedSinceQa, 0, "Agent session created during QA");
  const wouldDelete = { experienceId: String(ids.experienceId), interviewId: String(ids.interviewId),
    rewardId: String(ids.rewardId), snapshotId: String(snapshotId),
    pdfReference: String(snapshotId) };
  if (action === "cleanup-preview") return { wouldDelete, counts: state.counts, deleted: false };
  assert.equal(body.confirm, "DELETE_EXACT_QA_RECORDS", "Exact cleanup confirmation required");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const checked = await loadExact(ids, "post_finalize", session);
      assert.equal(checked.reward.status, "redeemed");
      assert.equal(checked.snapshots.length, 1);
      const deletes = [
        Snapshot.deleteOne({ _id: checked.reward.resumeSnapshotId, rewardId: ids.rewardId, userId: ids.userId }, { session }),
        Reward.deleteOne({ _id: ids.rewardId, userId: ids.userId, experienceId: ids.experienceId, campaignId: CAMPAIGN_ID }, { session }),
        InterviewQuestion.deleteOne({ _id: ids.interviewId, organizationName: QA.organization, note: QA.interviewNote }, { session }),
        Experience.deleteOne({ _id: ids.experienceId, submittedByUserId: ids.userId, organizationName: QA.organization }, { session }),
      ];
      for (const operation of deletes) assert.equal((await operation).deletedCount, 1, "Exact QA deletion failed");
    });
  } finally {
    await session.endSession();
  }
  const remaining = await Promise.all([
    Experience.countDocuments({ _id: ids.experienceId }), InterviewQuestion.countDocuments({ _id: ids.interviewId }),
    Reward.countDocuments({ _id: ids.rewardId }), Snapshot.countDocuments({ _id: snapshotId }),
  ]);
  assert.deepEqual(remaining, [0, 0, 0, 0], "QA records remain after cleanup");
  return { deleted: true, remaining: { experience: 0, interview: 0, reward: 0, snapshot: 0 } };
}

module.exports = { QA, parseIds, assertQaRecords, summary, runQaMaintenance };

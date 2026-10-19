// Temporary production QA cleanup. Remove this service and route before V1.1 global rollout.
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Experience = require("../models/Experience");
const Reward = require("../models/ExperienceResumeReward");
const Snapshot = require("../models/ExperienceResumeSnapshot");
const User = require("../models/User");
const ResumeProfile = require("../models/ResumeProfile");
const Subscription = require("../models/Subscription");
const ResumeAgentSession = require("../models/ResumeAgentSession");
const { CAMPAIGN_ID } = require("./experienceResumeReward");
const { QA_TEST_CAMPAIGN } = require("./experienceQaSubmission");
const { isExperienceRewardQaTestEnabled } = require("./experienceRewardRollout");

const exactId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const AI_RESET_IDS = Object.freeze({
  userId: "6ad4c81d101441eb032e467e",
  experienceId: "6ad56958fe291efa165aac62",
  rewardId: "6ad5696c101441eb03307200",
});
const AI_RESET_ATTEMPTED_AT = "2026-10-19T00:52:16.182Z";

async function loadExactQaRecords({ userId, experienceId, rewardId }, session) {
  assert([userId, experienceId, rewardId].every(exactId), "Exact ObjectIds required");
  assert(isExperienceRewardQaTestEnabled(userId), "Not the designated QA user in QA mode");
  const options = session ? { session } : {};
  const user = await User.findById(userId, null, options).lean();
  const experience = await Experience.findById(experienceId, null, options).lean();
  const reward = await Reward.findById(rewardId, null, options).lean();
  assert(user && user.accessCodeHash, "QA account is missing");
  assert(experience && experience.qaTest === true &&
    experience.qaTestCampaign === QA_TEST_CAMPAIGN &&
    String(experience.submittedByUserId) === userId &&
    experience.status === "approved", "Exact approved QA experience differs");
  assert(reward && String(reward.userId) === userId &&
    String(reward.experienceId) === experienceId &&
    reward.campaignId === CAMPAIGN_ID && reward.type === "single_ats_resume" &&
    reward.status === "redeemed" && reward.resumeSnapshotId,
  "Exact redeemed QA reward differs");
  const rewardCount = await Reward.countDocuments({ userId, campaignId: CAMPAIGN_ID }).session(session || null);
  const snapshotCount = await Snapshot.countDocuments({ rewardId }).session(session || null);
  const snapshot = await Snapshot.findById(reward.resumeSnapshotId, null, options).lean();
  assert.equal(rewardCount, 1, "QA campaign reward count differs");
  assert.equal(snapshotCount, 1, "QA snapshot count differs");
  assert(snapshot && String(snapshot.rewardId) === rewardId &&
    String(snapshot.userId) === userId &&
    (Buffer.isBuffer(snapshot.pdf) ? snapshot.pdf.length > 0 :
      Boolean(snapshot.pdf?.buffer?.length)), "Exact linked PDF snapshot differs");
  return { user, experience, reward, snapshot };
}

async function isolationCounts({ user, experience }) {
  const since = experience.createdAt;
  const [profiles, subscriptions, agentSessions] = await Promise.all([
    ResumeProfile.countDocuments({ $and: [
      { $or: [{ userId: user._id }, { contact: user.contact }] },
      { $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }] },
    ] }),
    Subscription.countDocuments({ email: user.contact, createdAt: { $gte: since } }),
    ResumeAgentSession.countDocuments({ userId: user._id, createdAt: { $gte: since } }),
  ]);
  return { resumeProfilesCreatedOrChanged: profiles, resumeSubscriptionsCreated: subscriptions,
    agentSessionsCreated: agentSessions,
    resumeEntitlement: (user.entitlements || []).includes("resume_builder") };
}

// Temporary read-only check for the one available QA reward before an AI-attempt reset.
async function verifyAvailableQaReward({ userId, experienceId, rewardId } = {}, expectAttempt = true) {
  assert([userId, experienceId, rewardId].every(exactId), "Exact ObjectIds required");
  assert(isExperienceRewardQaTestEnabled(userId), "Not the designated QA user in QA mode");
  const [experience, reward] = await Promise.all([
    Experience.findById(experienceId).lean(),
    Reward.findById(rewardId).lean(),
  ]);
  assert(experience && String(experience.submittedByUserId) === userId &&
    experience.status === "approved" && experience.qaTest === true &&
    experience.qaTestCampaign === QA_TEST_CAMPAIGN,
  "Exact approved QA experience differs");
  assert(reward && String(reward.userId) === userId &&
    String(reward.experienceId) === experienceId &&
    reward.campaignId === CAMPAIGN_ID && reward.status === "available" &&
    (expectAttempt ? Boolean(reward.aiGenerationAttemptedAt) : !reward.aiGenerationAttemptedAt) &&
    !reward.resumeSnapshotId && !reward.redeemedAt,
  "Exact available QA reward differs");
  // Snapshot.rewardId is the canonical reverse link; PDF bytes live in that snapshot.
  const snapshotCount = await Snapshot.countDocuments({ rewardId: reward._id });
  assert.equal(snapshotCount, 0, "QA reward already has a snapshot");
  return {
    reward: {
      _id: String(reward._id), userId: String(reward.userId),
      experienceId: String(reward.experienceId), campaignId: reward.campaignId,
      status: reward.status, aiGenerationAttemptedAt: reward.aiGenerationAttemptedAt,
      resumeSnapshotId: reward.resumeSnapshotId || null,
      redeemedAt: reward.redeemedAt || null,
    },
    experience: {
      _id: String(experience._id), userId: String(experience.submittedByUserId),
      status: experience.status, qaTest: experience.qaTest,
      qaTestCampaign: experience.qaTestCampaign,
    },
    artifacts: { snapshotCount, pdfReferenceCount: 0 },
    mutationPreview: {
      rewardId: String(reward._id),
      aiGenerationAttemptedAt: { from: reward.aiGenerationAttemptedAt, to: null },
      otherFieldsChanged: "NONE",
    },
  };
}

async function resetExactQaAiAttempt(body = {}) {
  const ids = { userId: body.userId, experienceId: body.experienceId,
    rewardId: body.rewardId };
  assert.deepEqual(ids, AI_RESET_IDS, "Only the approved QA reward may be reset");
  assert.equal(body.confirm, "RESET_EXACT_QA_AI_ATTEMPT", "Exact reset confirmation required");
  const before = await verifyAvailableQaReward(ids);
  assert.equal(new Date(before.reward.aiGenerationAttemptedAt).toISOString(),
    AI_RESET_ATTEMPTED_AT, "AI attempt timestamp differs");
  const beforeDocument = await Reward.findById(ids.rewardId).lean();
  const result = await Reward.collection.updateOne({
    _id: new mongoose.Types.ObjectId(ids.rewardId),
    userId: new mongoose.Types.ObjectId(ids.userId),
    experienceId: new mongoose.Types.ObjectId(ids.experienceId),
    campaignId: CAMPAIGN_ID,
    status: "available",
    aiGenerationAttemptedAt: new Date(AI_RESET_ATTEMPTED_AT),
    resumeSnapshotId: null,
    redeemedAt: null,
  }, { $set: { aiGenerationAttemptedAt: null } });
  assert.equal(result.matchedCount, 1, "Exact QA reward changed before reset");
  assert.equal(result.modifiedCount, 1, "Exact QA attempt was not reset once");
  const afterDocument = await Reward.findById(ids.rewardId).lean();
  const { aiGenerationAttemptedAt: oldAttempt, ...beforeUnchanged } = beforeDocument;
  const { aiGenerationAttemptedAt: newAttempt, ...afterUnchanged } = afterDocument;
  assert.equal(new Date(oldAttempt).toISOString(), AI_RESET_ATTEMPTED_AT);
  assert.equal(newAttempt, null);
  assert.deepEqual(afterUnchanged, beforeUnchanged, "Other reward fields changed");
  const after = await verifyAvailableQaReward(ids, false);
  for (const key of ["_id", "userId", "experienceId", "campaignId", "status",
    "resumeSnapshotId", "redeemedAt"]) {
    assert.deepEqual(after.reward[key], before.reward[key], `Reward ${key} changed`);
  }
  assert.deepEqual(after.experience, before.experience, "QA experience changed");
  return { reset: true, reward: after.reward, experience: after.experience,
    artifacts: after.artifacts, otherFieldsChanged: "NONE" };
}

async function runExperienceRewardV11QaCleanup(body = {}) {
  if (body.action === "verify-available-reward") return verifyAvailableQaReward(body);
  if (body.action === "reset-qa-ai-attempt") return resetExactQaAiAttempt(body);
  assert(["preview", "cleanup"].includes(body.action), "Unsupported QA action");
  const ids = { userId: body.userId, experienceId: body.experienceId, rewardId: body.rewardId };
  const records = await loadExactQaRecords(ids);
  const isolation = await isolationCounts(records);
  assert.deepEqual(isolation, { resumeProfilesCreatedOrChanged: 0,
    resumeSubscriptionsCreated: 0, agentSessionsCreated: 0, resumeEntitlement: false },
  "Reward isolation differs");
  const wouldDelete = { experienceId: ids.experienceId, rewardId: ids.rewardId,
    snapshotId: String(records.snapshot._id), pdfReferenceCount: 1 };
  if (body.action === "preview") return { wouldDelete, isolation, deleted: false };
  assert.equal(body.confirm, "DELETE_EXACT_QA_RECORDS", "Exact cleanup confirmation required");
  assert.equal(body.snapshotId, wouldDelete.snapshotId, "Previewed snapshot differs");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await loadExactQaRecords(ids, session);
      assert.equal(String(current.snapshot._id), body.snapshotId);
      const snapshotDelete = await Snapshot.deleteOne({ _id: current.snapshot._id,
        rewardId: ids.rewardId, userId: ids.userId }, { session });
      const rewardDelete = await Reward.deleteOne({ _id: ids.rewardId, userId: ids.userId,
        experienceId: ids.experienceId, campaignId: CAMPAIGN_ID }, { session });
      const experienceDelete = await Experience.deleteOne({ _id: ids.experienceId,
        submittedByUserId: ids.userId, qaTest: true,
        qaTestCampaign: QA_TEST_CAMPAIGN }, { session });
      assert.deepEqual([snapshotDelete.deletedCount, rewardDelete.deletedCount,
        experienceDelete.deletedCount], [1, 1, 1], "Exact QA deletion differs");
    });
  } finally {
    await session.endSession();
  }
  const remaining = await Promise.all([
    Experience.countDocuments({ _id: ids.experienceId }),
    Reward.countDocuments({ _id: ids.rewardId }),
    Snapshot.countDocuments({ _id: body.snapshotId }),
  ]);
  assert.deepEqual(remaining, [0, 0, 0], "QA records remain after cleanup");
  return { deleted: true, remaining: { experience: 0, reward: 0, snapshot: 0 },
    qaAccountRetained: true, customerRecordsTouched: 0 };
}

module.exports = { loadExactQaRecords, verifyAvailableQaReward,
  resetExactQaAiAttempt, runExperienceRewardV11QaCleanup };

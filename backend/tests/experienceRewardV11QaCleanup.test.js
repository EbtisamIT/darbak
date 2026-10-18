const assert = require("node:assert/strict");
const Experience = require("../models/Experience");
const Reward = require("../models/ExperienceResumeReward");
const Snapshot = require("../models/ExperienceResumeSnapshot");
const User = require("../models/User");
const ResumeProfile = require("../models/ResumeProfile");
const Subscription = require("../models/Subscription");
const ResumeAgentSession = require("../models/ResumeAgentSession");
const { runExperienceRewardV11QaCleanup } = require("../services/experienceRewardV11QaCleanup");

const ids = {
  userId: "6ad4c81d101441eb032e467e",
  experienceId: "6bd4c81d101441eb032e467e",
  rewardId: "6cd4c81d101441eb032e467e",
  snapshotId: "6dd4c81d101441eb032e467e",
};
const originalMode = process.env.EXPERIENCE_REWARD_V11_MODE;
const originals = [];
const replace = (model, key, value) => {
  originals.push([model, key, model[key]]);
  model[key] = value;
};
const lean = (value) => ({ lean: async () => value });
const count = (value) => ({ session: async () => value });

async function main() {
  process.env.EXPERIENCE_REWARD_V11_MODE = "qa";
  replace(User, "findById", () => lean({ _id: ids.userId,
    contact: "qa@example.invalid", accessCodeHash: "present", entitlements: [] }));
  replace(Experience, "findById", () => lean({ _id: ids.experienceId,
    qaTest: true, qaTestCampaign: "experience-reward-v1.1",
    submittedByUserId: ids.userId, status: "approved", createdAt: new Date() }));
  replace(Reward, "findById", () => lean({ _id: ids.rewardId,
    userId: ids.userId, experienceId: ids.experienceId,
    campaignId: "experience-reward-v1", type: "single_ats_resume",
    status: "redeemed", resumeSnapshotId: ids.snapshotId }));
  replace(Reward, "countDocuments", () => count(1));
  replace(Snapshot, "countDocuments", () => count(1));
  replace(Snapshot, "findById", () => lean({ _id: ids.snapshotId,
    userId: ids.userId, rewardId: ids.rewardId, pdf: Buffer.from("%PDF-test") }));
  replace(ResumeProfile, "countDocuments", async () => 0);
  replace(Subscription, "countDocuments", async () => 0);
  replace(ResumeAgentSession, "countDocuments", async () => 0);

  const preview = await runExperienceRewardV11QaCleanup({ ...ids, action: "preview" });
  assert.deepEqual(preview.wouldDelete, { experienceId: ids.experienceId,
    rewardId: ids.rewardId, snapshotId: ids.snapshotId, pdfReferenceCount: 1 });
  assert.equal(preview.deleted, false);
  await assert.rejects(runExperienceRewardV11QaCleanup({ ...ids,
    rewardId: "other", action: "preview" }), /Exact ObjectIds required/);
  replace(Reward, "countDocuments", () => count(2));
  await assert.rejects(runExperienceRewardV11QaCleanup({ ...ids, action: "preview" }),
    /QA campaign reward count differs/);
  process.env.EXPERIENCE_REWARD_V11_MODE = "all";
  await assert.rejects(runExperienceRewardV11QaCleanup({ ...ids, action: "preview" }),
    /Not the designated QA user/);
  console.log("Exact QA cleanup preview and safety gates: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  originals.reverse().forEach(([model, key, value]) => { model[key] = value; });
  if (originalMode === undefined) delete process.env.EXPERIENCE_REWARD_V11_MODE;
  else process.env.EXPERIENCE_REWARD_V11_MODE = originalMode;
});

const assert = require("node:assert/strict");
const Experience = require("../models/Experience");
const Reward = require("../models/ExperienceResumeReward");
const Snapshot = require("../models/ExperienceResumeSnapshot");
const { runExperienceRewardV11QaCleanup } = require("../services/experienceRewardV11QaCleanup");

const ids = {
  userId: "6ad4c81d101441eb032e467e",
  experienceId: "6bd4c81d101441eb032e467e",
  rewardId: "6cd4c81d101441eb032e467e",
};
const attemptedAt = new Date("2026-10-19T01:00:00Z");
const originalMode = process.env.EXPERIENCE_REWARD_V11_MODE;
const originals = [];
const replace = (model, key, value) => {
  originals.push([model, key, model[key]]);
  model[key] = value;
};
const lean = (value) => ({ lean: async () => value });

async function main() {
  process.env.EXPERIENCE_REWARD_V11_MODE = "qa";
  const experience = { _id: ids.experienceId, submittedByUserId: ids.userId,
    status: "approved", qaTest: true, qaTestCampaign: "experience-reward-v1.1" };
  const reward = { _id: ids.rewardId, userId: ids.userId,
    experienceId: ids.experienceId, campaignId: "experience-reward-v1",
    status: "available", aiGenerationAttemptedAt: attemptedAt,
    resumeSnapshotId: null, redeemedAt: null };
  replace(Experience, "findById", () => lean(experience));
  replace(Reward, "findById", () => lean(reward));
  replace(Snapshot, "countDocuments", async (query) => {
    assert.equal(query.rewardId, ids.rewardId);
    return 0;
  });

  const result = await runExperienceRewardV11QaCleanup({ ...ids,
    action: "verify-available-reward" });
  assert.equal(result.reward.campaignId, "experience-reward-v1");
  assert.equal(result.reward.status, "available");
  assert.equal(result.reward.aiGenerationAttemptedAt, attemptedAt);
  assert.deepEqual(result.artifacts, { snapshotCount: 0, pdfReferenceCount: 0 });
  assert.deepEqual(result.mutationPreview, { rewardId: ids.rewardId,
    aiGenerationAttemptedAt: { from: attemptedAt, to: null },
    otherFieldsChanged: "NONE" });
  assert.equal(reward.aiGenerationAttemptedAt, attemptedAt);

  reward.campaignId = "experience-reward-v1.1";
  await assert.rejects(runExperienceRewardV11QaCleanup({ ...ids,
    action: "verify-available-reward" }), /Exact available QA reward differs/);
  reward.campaignId = "experience-reward-v1";
  experience.qaTest = false;
  await assert.rejects(runExperienceRewardV11QaCleanup({ ...ids,
    action: "verify-available-reward" }), /Exact approved QA experience differs/);
  experience.qaTest = true;
  replace(Snapshot, "countDocuments", async () => 1);
  await assert.rejects(runExperienceRewardV11QaCleanup({ ...ids,
    action: "verify-available-reward" }), /QA reward already has a snapshot/);
  console.log("Available QA reward read-only verification: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  originals.reverse().forEach(([model, key, value]) => { model[key] = value; });
  if (originalMode === undefined) delete process.env.EXPERIENCE_REWARD_V11_MODE;
  else process.env.EXPERIENCE_REWARD_V11_MODE = originalMode;
});

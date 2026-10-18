const assert = require("node:assert/strict");
const {
  CAMPAIGN_ID, trainingPrefill, grantApprovedExperienceReward,
  findRewardAccount, findOwnedReward, saveRewardDraft, finalizeReward, hasCompleteRewardDraft,
} = require("../services/experienceResumeReward");
const RewardModel = require("../models/ExperienceResumeReward");
const SnapshotModel = require("../models/ExperienceResumeSnapshot");

const records = [];
const snapshots = [];
const lean = (value) => ({ lean: async () => value });
const matches = (record, query) => Object.entries(query).every(([key, value]) => {
  if (key === "$or") return value.some((part) => matches(record, part));
  return String(record[key] ?? "") === String(value ?? "");
});
const Reward = {
  findOne: (query) => lean(records.find((item) => matches(item, query)) || null),
  findOneAndUpdate(query, update, options = {}) {
    let record = records.find((item) => matches(item, query));
    if (!record && options.upsert) {
      record = { _id: `reward-${records.length + 1}`, ...update.$setOnInsert };
      records.push(record);
    } else if (record && update.$set) Object.assign(record, update.$set);
    return options.upsert ? Promise.resolve(record || null) : lean(record || null);
  },
};
const Snapshot = {
  findOne: (query) => lean(snapshots.find((item) => matches(item, query)) || null),
  async create(data) {
    if (snapshots.some((item) => item.rewardId === data.rewardId)) {
      const error = new Error("duplicate"); error.code = 11000; throw error;
    }
    const record = { _id: `snapshot-${snapshots.length + 1}`, ...data };
    snapshots.push(record);
    return record;
  },
};

async function run() {
  const authOptions = {
    User: { findOne: (query) => lean(query.contact === "student@example.com" && query.accessCodeHash === "hash:ABCD1234"
      ? { _id: "user-1" } : null) },
    normalizeContact: (value) => value.toLowerCase().trim(),
    normalizeCode: (value) => value.trim(),
    validContact: (value) => value.includes("@"),
    validCode: (value) => value.length >= 4,
    hashCode: (_, code) => `hash:${code}`,
  };
  assert.equal(await findRewardAccount({ ...authOptions, rawContact: "", rawCode: "" }), null, "route requires identity");
  assert.equal(await findRewardAccount({ ...authOptions, rawContact: "student@example.com", rawCode: "wrong" }), null, "wrong code denied");
  assert.equal((await findRewardAccount({ ...authOptions, rawContact: "STUDENT@example.com", rawCode: "ABCD1234" }))._id, "user-1");
  assert.equal(RewardModel.schema.path("expiresAt"), undefined, "v1 has no expiry");
  assert.equal(RewardModel.schema.path("subscriptionId"), undefined, "reward is independent");
  assert.equal(SnapshotModel.schema.path("pdf").instance, "Buffer");
  assert.ok(RewardModel.schema.indexes().some(([fields, options]) => fields.userId === 1 && fields.campaignId === 1 && options.unique));
  assert.ok(RewardModel.schema.indexes().some(([fields, options]) => fields.experienceId === 1 && fields.campaignId === 1 && options.unique));
  const base = { _id: "experience-1", submittedByUserId: "user-1", status: "pending", sourceType: "direct" };
  assert.equal(await grantApprovedExperienceReward(base, Reward), null, "pending: no reward");
  assert.equal(await grantApprovedExperienceReward({ ...base, status: "rejected" }, Reward), null, "rejected: no reward");
  assert.equal(await grantApprovedExperienceReward({ ...base, status: "approved", submittedByUserId: null }, Reward), null, "anonymous: no reward");
  assert.equal(await grantApprovedExperienceReward({ ...base, status: "approved", sourceType: "public_summary" }, Reward), null, "public summary: no reward");
  assert.equal(records.length, 0);

  const approved = { ...base, status: "approved" };
  let sourceExperience = approved;
  const Experience = { findById: (id) => lean(String(id) === String(sourceExperience?._id) ? sourceExperience : null) };
  const reward = await grantApprovedExperienceReward(approved, Reward);
  assert.equal(reward.status, "available");
  assert.equal(reward.campaignId, CAMPAIGN_ID);
  assert.equal((await grantApprovedExperienceReward(approved, Reward))._id, reward._id, "repeat approval idempotent");
  assert.equal((await grantApprovedExperienceReward({ ...approved, _id: "experience-2" }, Reward))._id, reward._id, "one per user/campaign");
  assert.equal(records.length, 1);
  assert.equal((await findOwnedReward({ userId: "user-1", Reward }))._id, reward._id);
  assert.equal(await findOwnedReward({ userId: "user-2", Reward }), null, "another user's reward is not visible");

  const prefill = trainingPrefill({ organizationName: "DataVolt", city: "الرياض", major: "تقنية المعلومات",
    description: "مهام التدريب", duration: "ثلاثة أشهر" }, { firstName: "طالب", contact: "student@example.com" });
  assert.equal(prefill.trainingExperience[0].organization, "DataVolt");
  assert.equal(prefill.trainingExperience[0].description, "", "public narrative is not copied to the CV");
  assert.equal(trainingPrefill({ ...approved, description: "وصف التجربة القديم" }, {},
    { includeNarrative: true }).trainingExperience[0].description, "وصف التجربة القديم",
  "non-QA V1 prefill is preserved");
  const draft = { ...prefill, fullName: "طالب دربك", university: "جامعة الملك سعود",
    educationCity: "الرياض", graduationYear: "2026",
    trainingExperience: [{ ...prefill.trainingExperience[0], description: "أعددت تقارير باستخدام Excel" }],
    skills: ["Excel", "SQL", "التواصل"] };
  const saved = await saveRewardDraft({ userId: "user-1", language: "ar", draft, Reward });
  assert.equal(saved.status, "available", "preview/draft does not consume reward");
  assert.equal(saved.draft.trainingExperience[0].organization, "DataVolt");
  assert.equal(await saveRewardDraft({ userId: "user-1", language: "en", draft, Reward }), null, "one language only");
  assert.equal(await saveRewardDraft({ userId: "user-2", language: "ar", draft, Reward }), null, "another user cannot edit reward");

  const pdf = Buffer.from(`%PDF-1.4\n${"x".repeat(120)}\n%%EOF`);
  const incompleteCases = [
    ["missing name", { ...draft, fullName: "" }],
    ["no usable contact", { ...draft, email: "invalid", phone: "123" }],
    ["missing university", { ...draft, university: "" }],
    ["missing major", { ...draft, major: "" }],
    ["missing graduation year", { ...draft, graduationYear: "" }],
    ["missing education city", { ...draft, educationCity: "" }],
    ["missing training", { ...draft, trainingExperience: [] }],
    ["training without contribution", { ...draft, trainingExperience: [{ ...draft.trainingExperience[0], description: "" }] }],
    ["fewer than three distinct skills", { ...draft, skills: ["SQL", "SQL", "Excel"] }],
  ];
  for (const [label, incompleteDraft] of incompleteCases) {
    await saveRewardDraft({ userId: "user-1", language: "ar", draft: incompleteDraft, Reward });
    assert.equal((await finalizeReward({ userId: "user-1", pdf, Reward, Snapshot, Experience })).status,
      "incomplete", label);
    assert.equal(reward.status, "available", `${label}: reward remains available`);
    assert.equal(snapshots.length, 0, `${label}: no snapshot`);
  }
  sourceExperience = { ...approved, submittedByUserId: "user-2" };
  await saveRewardDraft({ userId: "user-1", language: "ar", draft, Reward });
  assert.equal((await finalizeReward({ userId: "user-1", pdf, Reward, Snapshot, Experience })).status,
    "incomplete", "reward-linked source must belong to the account");
  sourceExperience = { ...approved, status: "rejected" };
  assert.equal((await finalizeReward({ userId: "user-1", pdf, Reward, Snapshot, Experience })).status,
    "incomplete", "source must still be approved");
  sourceExperience = approved;
  assert.equal(hasCompleteRewardDraft({ ...reward, draft: {
    ...draft, email: "", phone: "+966 50 000 0000",
  } }, approved, "user-1"), true, "phone is a usable contact method");
  assert.equal(hasCompleteRewardDraft({ ...reward, draft: {
    ...draft, graduationYear: "", educationCity: "",
  } }, approved, "user-1", { v11Enabled: false }), true,
  "non-QA V1 completeness is preserved");
  assert.equal(hasCompleteRewardDraft({ ...reward, draft: {
    ...draft, trainingExperience: [{ ...draft.trainingExperience[0], description: "نص التجربة الحواري" }],
  } }, { ...approved, description: "نص التجربة الحواري" }, "user-1"), false,
  "public conversational narrative cannot be finalized as a CV bullet");
  assert.equal((await finalizeReward({ userId: "user-1", pdf: Buffer.from("bad"), Reward, Snapshot, Experience })).status,
    "invalid_pdf", "invalid PDF does not consume reward");
  assert.equal(reward.status, "available");
  const finalized = await finalizeReward({ userId: "user-1", pdf, Reward, Snapshot, Experience });
  assert.equal(finalized.status, "redeemed");
  assert.equal(records[0].status, "redeemed");
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].pdf, pdf, "same immutable bytes remain downloadable");
  assert.equal((await finalizeReward({ userId: "user-1", pdf, Reward, Snapshot, Experience })).status, "unavailable", "repeat finalize blocked");
  assert.equal((await finalizeReward({ userId: "user-2", pdf, Reward, Snapshot, Experience })).status, "unavailable", "another user cannot finalize");
  assert.equal(snapshots.length, 1);
  assert.equal(records[0].type, "single_ats_resume");
  assert.equal(records[0].subscription, undefined, "no subscription grant");
  assert.equal(records[0].resumeProfile, undefined, "no ResumeProfile mutation");
  console.log("Experience reward local lifecycle: PASS");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });

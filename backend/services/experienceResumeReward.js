const CAMPAIGN_ID = "experience-reward-v1";

const cleanText = (value, max = 300) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const cleanEntries = (value) => (Array.isArray(value) ? value : []).slice(0, 20).map((item) => ({
  title: cleanText(item?.title, 180),
  organization: cleanText(item?.organization, 180),
  location: cleanText(item?.location, 100),
  period: cleanText(item?.period, 100),
  description: cleanText(item?.description, 2000),
}));

const cleanResumeData = (raw = {}) => ({
  fullName: cleanText(raw.fullName, 160),
  city: cleanText(raw.city, 100),
  email: cleanText(raw.email, 200),
  phone: cleanText(raw.phone, 30),
  linkedin: cleanText(raw.linkedin, 300),
  major: cleanText(raw.major, 150),
  university: cleanText(raw.university, 180),
  graduationYear: cleanText(raw.graduationYear, 20),
  gpa: cleanText(raw.gpa, 30),
  experience: cleanEntries(raw.experience),
  trainingExperience: cleanEntries(raw.trainingExperience).slice(0, 1),
  projects: cleanEntries(raw.projects),
  certifications: cleanEntries(raw.certifications),
  skills: (Array.isArray(raw.skills) ? raw.skills : []).slice(0, 40).map((v) => cleanText(v, 80)).filter(Boolean),
  languages: (Array.isArray(raw.languages) ? raw.languages : []).slice(0, 15).map((v) => ({
    name: cleanText(v?.name, 80), level: cleanText(v?.level, 80),
  })),
});

const trainingPrefill = (experience = {}, user = {}) => ({
  fullName: cleanText(user.firstName, 160),
  city: cleanText(experience.city, 100),
  email: cleanText(user.contact, 200),
  phone: "", linkedin: "",
  major: cleanText(experience.major, 150),
  university: "", graduationYear: "", gpa: "",
  experience: [],
  trainingExperience: [{
    title: cleanText(experience.trainingTitle || experience.department || "تدريب تعاوني", 180),
    organization: cleanText(experience.organizationName, 180),
    location: cleanText(experience.city, 100),
    period: cleanText(experience.trainingYear || experience.duration, 100),
    description: cleanText(experience.description, 2000),
  }],
  projects: [], certifications: [], skills: [], languages: [],
});

async function findRewardAccount({ rawContact, rawCode, User, normalizeContact, normalizeCode, validContact, validCode, hashCode }) {
  const contact = normalizeContact(rawContact || "");
  const accessCode = normalizeCode(rawCode || "");
  if (!validContact(contact) || !validCode(accessCode)) return null;
  return User.findOne({ contact, accessCodeHash: hashCode(contact, accessCode) }).lean();
}

const findOwnedReward = ({ userId, Reward }) =>
  Reward.findOne({ userId, campaignId: CAMPAIGN_ID }).lean();

async function grantApprovedExperienceReward(experience, Reward) {
  if (experience?.status !== "approved" || !experience?.submittedByUserId || experience?.sourceType === "public_summary") return null;
  if (typeof Reward.init === "function") await Reward.init();
  try {
    return await Reward.findOneAndUpdate(
      { userId: experience.submittedByUserId, campaignId: CAMPAIGN_ID },
      { $setOnInsert: {
        userId: experience.submittedByUserId,
        experienceId: experience._id,
        campaignId: CAMPAIGN_ID,
        type: "single_ats_resume",
        status: "available",
        grantedAt: new Date(),
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Reward.findOne({ userId: experience.submittedByUserId, campaignId: CAMPAIGN_ID });
  }
}

async function saveRewardDraft({ userId, language, draft, Reward }) {
  if (!["ar", "en"].includes(language)) return null;
  return Reward.findOneAndUpdate(
    { userId, campaignId: CAMPAIGN_ID, status: "available",
      $or: [{ language: null }, { language }] },
    { $set: { language, draft: cleanResumeData(draft) } }, { new: true }
  ).lean();
}

const hasUsableContact = (draft) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(draft?.email, 200)) ||
  /^\+?\d{8,15}$/.test(cleanText(draft?.phone, 30).replace(/[\s()-]/g, ""));

const hasCompleteRewardDraft = (reward, experience, userId) => {
  const draft = reward?.draft;
  const training = draft?.trainingExperience?.[0];
  const education = Boolean(cleanText(draft?.major) && cleanText(draft?.university));
  const qualification = (draft?.certifications || []).some((entry) =>
    cleanText(entry?.title) && cleanText(entry?.organization));
  const skills = new Set((draft?.skills || []).map((skill) => cleanText(skill, 80)).filter(Boolean));
  return Boolean(
    String(experience?._id || "") === String(reward?.experienceId || "") &&
    experience?.status === "approved" &&
    experience?.sourceType !== "public_summary" &&
    String(experience?.submittedByUserId || "") === String(userId) &&
    cleanText(draft?.fullName) && hasUsableContact(draft) &&
    (education || qualification) &&
    cleanText(training?.title) && cleanText(training?.organization) &&
    cleanText(training?.description) && skills.size >= 3 &&
    ["ar", "en"].includes(reward?.language)
  );
};

async function finalizeReward({ userId, pdf, Reward, Snapshot, Experience }) {
  const reward = await findOwnedReward({ userId, Reward });
  if (!reward || reward.status !== "available") return { status: "unavailable" };
  const experience = reward.experienceId ? await Experience.findById(reward.experienceId).lean() : null;
  if (!hasCompleteRewardDraft(reward, experience, userId)) return { status: "incomplete" };
  if (!Buffer.isBuffer(pdf) || pdf.length < 100 || pdf.length > 2 * 1024 * 1024 ||
    pdf.subarray(0, 5).toString() !== "%PDF-" ||
    !pdf.subarray(-1024).toString().includes("%%EOF")) return { status: "invalid_pdf" };

  let snapshot = await Snapshot.findOne({ rewardId: reward._id }).lean();
  if (!snapshot) {
    if (typeof Snapshot.init === "function") await Snapshot.init();
    try {
      snapshot = await Snapshot.create({
        rewardId: reward._id, userId, language: reward.language,
        resumeData: reward.draft, pdf,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      snapshot = await Snapshot.findOne({ rewardId: reward._id }).lean();
    }
  }
  const redeemed = await Reward.findOneAndUpdate(
    { _id: reward._id, userId, status: "available" },
    { $set: { status: "redeemed", redeemedAt: new Date(), resumeSnapshotId: snapshot._id } },
    { new: true }
  ).lean();
  return { status: redeemed ? "redeemed" : "unavailable", snapshotId: snapshot._id };
}

module.exports = {
  CAMPAIGN_ID, cleanResumeData, trainingPrefill,
  findRewardAccount, findOwnedReward,
  grantApprovedExperienceReward, saveRewardDraft, finalizeReward, hasCompleteRewardDraft,
};

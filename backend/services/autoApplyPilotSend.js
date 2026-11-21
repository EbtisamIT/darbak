const { isCurrentVerifiedChannel } = require("./autoApplyV1");

function documentRequirements(channel = {}) {
  return {
    resume: channel.requiredDocuments?.resume || "required",
    academicTranscript: channel.requiredDocuments?.academicTranscript || "unknown",
    trainingLetter: channel.requiredDocuments?.trainingLetter || "unknown",
  };
}

function documentsSatisfied({ channel, resume, documents = [], now = new Date() }) {
  const requirements = documentRequirements(channel);
  const current = documents.filter((item) => !item.expiresAt || new Date(item.expiresAt) >= now);
  const transcript = current.some((item) => item.type === "academic_transcript");
  const trainingLetter = current.some((item) => item.type === "training_letter" && (
    item.scope === "general" || (item.scope === "company_specific" && String(item.companyId) === String(channel.companyId))
  ));
  const missing = [];
  if (requirements.resume === "required" && !resume) missing.push("resume");
  if (requirements.academicTranscript === "required" && !transcript) missing.push("academic_transcript");
  if (requirements.trainingLetter === "required" && !trainingLetter) missing.push("training_letter");
  return { ok: missing.length === 0, missing, requirements };
}

function assertReviewApproved({ item, channel, documentState, profile }) {
  if (!item || item.status !== "approved" || item.eligibility !== "eligible") {
    throw Object.assign(new Error("AUTO_APPLY_REVIEW_NOT_APPROVED"), { status: 409 });
  }
  if (!profile?.realSendConsentAt) {
    throw Object.assign(new Error("AUTO_APPLY_FIRST_SEND_CONFIRMATION_REQUIRED"), { status: 409 });
  }
  if (!isCurrentVerifiedChannel(channel)) {
    throw Object.assign(new Error("AUTO_APPLY_CHANNEL_NOT_VERIFIED"), { status: 409 });
  }
  if (!documentState?.ok) {
    throw Object.assign(new Error("AUTO_APPLY_REQUIRED_DOCUMENT_MISSING"), { status: 409, missing: documentState?.missing || [] });
  }
}

async function assertSendLimits({ SendModel, userId, limits, now = new Date() }) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const [total, daily] = await Promise.all([
    SendModel.countDocuments({ userId, isTest: false, status: "accepted" }),
    SendModel.countDocuments({ userId, isTest: false, status: "accepted", acceptedAt: { $gte: start } }),
  ]);
  if (total >= limits.total) throw Object.assign(new Error("AUTO_APPLY_PILOT_TOTAL_LIMIT_REACHED"), { status: 429 });
  if (daily >= limits.daily) throw Object.assign(new Error("AUTO_APPLY_PILOT_DAILY_LIMIT_REACHED"), { status: 429 });
  return { total, daily };
}

const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);

async function reserveSendSlot({ QuotaModel, userId, limits, now = new Date() }) {
  const today = dayKey(now);
  await QuotaModel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { totalReserved: 0, dayKey: today, dayReserved: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await QuotaModel.updateOne(
    { userId, dayKey: { $ne: today } },
    { $set: { dayKey: today, dayReserved: 0 } },
  );
  const quota = await QuotaModel.findOneAndUpdate(
    { userId, dayKey: today, totalReserved: { $lt: limits.total }, dayReserved: { $lt: limits.daily } },
    { $inc: { totalReserved: 1, dayReserved: 1 } },
    { new: true },
  );
  if (!quota) throw Object.assign(new Error("AUTO_APPLY_PILOT_SEND_LIMIT_REACHED"), { status: 429 });
  return { dayKey: today };
}

async function releaseSendSlot({ QuotaModel, userId, reservation }) {
  if (!reservation) return;
  const update = { $inc: { totalReserved: -1 } };
  if (reservation.dayKey === dayKey()) update.$inc.dayReserved = -1;
  await QuotaModel.updateOne({ userId }, update).catch(() => {});
}

module.exports = {
  documentRequirements,
  documentsSatisfied,
  assertReviewApproved,
  assertSendLimits,
  reserveSendSlot,
  releaseSendSlot,
};

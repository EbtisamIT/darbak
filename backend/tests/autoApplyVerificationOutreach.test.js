const assert = require("node:assert/strict");
const { needsFollowup, outreachUpdate, outreachCounters } = require("../services/autoApplyVerificationOutreach");
const { validateReview } = require("../services/autoApplyEmailNetwork");

const now = new Date("2026-10-31T12:00:00Z");
const contactedAt = new Date("2026-10-26T12:00:00Z");
const likely = { verificationStatus: "likely", outreachStatus: "waiting_response", verificationContactedAt: contactedAt };
assert.equal(needsFollowup(likely, now), true);
assert.equal(outreachUpdate(likely, "mark_followup", {}, now).outreachStatus, "followup_sent");
assert.throws(() => outreachUpdate({ ...likely, verificationFollowupAt: now }, "mark_followup", {}, now));
assert.throws(() => outreachUpdate(likely, "record_response", { note: "confirmed", decision: "verified" }, now));
const response = outreachUpdate(likely, "record_response", { note: "Official reply requires review." }, now);
assert.equal(response.outreachStatus, "waiting_response");
assert.equal(outreachUpdate({ ...likely, ...response, verificationStatus: "verified", acceptsTrainingApplications: true,
  evidenceType: "official_company_reply" }, "record_response", { note: "Official reply confirms training.", decision: "verified" }, now).outreachStatus, "verified_from_reply");
assert.equal(outreachCounters([{ ...likely }, { outreachStatus: "verified_from_reply", verificationContactedAt: contactedAt }]).verifiedFromReplies, 1);

const evidence = { channelType: "evergreen_training", verificationStatus: "verified", evidenceType: "official_company_reply",
  evidenceTextSummary: "أكدت الجهة رسميًا استقبال طلبات التدريب التعاوني عبر البريد المحدد.", evidenceDate: "2026-10-31",
  majors: [], cities: [], availabilityMode: "seasonal", seasonNote: "بداية الفصل الدراسي" };
const candidate = { email: "training@example.org", verificationRespondedAt: now, verificationResponseNote: "Confirmed by official reply." };
assert.throws(() => validateReview(evidence, { email: candidate.email }, now));
assert.equal(validateReview(evidence, candidate, now).acceptsTrainingApplications, true);
console.log("Auto Apply verification outreach: PASS");

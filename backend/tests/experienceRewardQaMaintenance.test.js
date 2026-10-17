const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { QA, parseIds, assertQaRecords, summary } = require("../services/experienceRewardQaMaintenance");

const oid = (last) => new mongoose.Types.ObjectId(`0000000000000000000000${last}`);
const ids = { userId: oid("01"), experienceId: oid("02"), interviewId: oid("03"), rewardId: oid("04") };
process.env.EXPERIENCE_REWARD_QA_USER_ID = String(ids.userId);
const now = new Date("2026-10-18T12:00:00.000Z");
const records = {
  ids,
  user: { _id: ids.userId, contact: QA.contact, entitlements: [] },
  experience: { _id: ids.experienceId, submittedByUserId: ids.userId,
    organizationName: QA.organization, city: QA.city, major: QA.major,
    description: QA.description, status: "approved", createdAt: now },
  interview: { _id: ids.interviewId, organizationName: QA.organization,
    city: QA.city, major: QA.major, questions: [QA.interviewQuestion], note: QA.interviewNote,
    createdAt: new Date(now.getTime() + 60000) },
  reward: { _id: ids.rewardId, userId: ids.userId, experienceId: ids.experienceId,
    campaignId: "experience-reward-v1", type: "single_ats_resume", status: "available",
    resumeSnapshotId: null },
  snapshots: [],
};

const body = Object.fromEntries(Object.entries(ids).map(([key, value]) => [key, String(value)]));
assert.deepEqual(Object.keys(parseIds(body)).sort(), Object.keys(ids).sort());
assert.throws(() => parseIds({ ...body, rewardId: "" }), /Four exact/);
assert.throws(() => parseIds({ ...body, experienceId: { $ne: null } }), /Four exact/);
assert.throws(() => parseIds({ ...body, snapshotId: "not-an-id" }), /snapshotId/);
assert.doesNotThrow(() => assertQaRecords(records));
assert.equal(summary(records, {}).counts.pdf, 0);
assert.throws(() => assertQaRecords({ ...records, user: { ...records.user, contact: "customer@example.com" } }));
assert.throws(() => assertQaRecords({ ...records, experience: { ...records.experience, submittedByUserId: oid("09") } }));
assert.throws(() => assertQaRecords({ ...records, interview: { ...records.interview, note: "ordinary interview" } }));
assert.throws(() => assertQaRecords({ ...records, interview: { ...records.interview,
  createdAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) } }));
assert.throws(() => assertQaRecords({ ...records, reward: { ...records.reward, experienceId: oid("09") } }));

const snapshotId = oid("05");
const redeemed = { ...records,
  ids: { ...ids, snapshotId },
  reward: { ...records.reward, status: "redeemed", resumeSnapshotId: snapshotId },
  snapshots: [{ _id: snapshotId, rewardId: ids.rewardId, userId: ids.userId,
    pdf: Buffer.from("%PDF-1.4") }],
};
assert.doesNotThrow(() => assertQaRecords(redeemed));
assert.equal(summary(redeemed, {}).counts.pdf, 1);
assert.throws(() => assertQaRecords({ ...redeemed, snapshots: [
  ...redeemed.snapshots, { ...redeemed.snapshots[0], _id: oid("06") },
] }), /Duplicate snapshot/);

const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
assert.match(server, /EXPERIENCE_REWARD_QA_MAINTENANCE_ENABLED !== "true" \|\| getExperienceRewardMode\(\) !== "qa"/);
assert.match(server, /return requireAdmin\(req, res, next\)/);
assert.match(server, /app\.post\("\/api\/admin\/experience-reward-qa-maintenance"/);
console.log("Experience reward QA maintenance safety: PASS");

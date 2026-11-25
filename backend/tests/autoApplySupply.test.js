const assert = require("node:assert/strict");
const { test } = require("node:test");
const Supply = require("../models/AutoApplySupply");
const { ingestSupply, eligibleSupplyFilter, findEligibleSupply } = require("../services/autoApplySupply");
const { legacyEmailObservation } = require("../services/legacyAutoApplySupply");

const first = new Date("2026-10-01T12:00:00Z");
const second = new Date("2026-10-02T12:00:00Z");
const email = {
  companyName: "Example Training", channelType: "EMAIL", destinationEmail: "training@example.org",
  opportunityTitle: "Co-op 2026", sourceUrl: "https://example.org/co-op", sourceType: "official_training_page",
  evidenceText: "Co-op candidates can apply to the training inbox.",
};
const verified = { ...email, emailTrainingConfirmed: true, verificationStatus: "VERIFIED", verificationReason: "Official training instructions" };

function memoryModel() {
  const rows = new Map();
  const model = {
    rows,
    findOne: ({ dedupeKey }) => ({ lean: async () => structuredClone(rows.get(dedupeKey) ?? null) }),
    async create(data) {
      if (rows.has(data.dedupeKey)) throw Object.assign(new Error("Duplicate key"), { code: 11000 });
      const document = new Supply({ ...data, __v: 0 });
      await document.validate();
      if (rows.has(data.dedupeKey)) throw Object.assign(new Error("Duplicate key"), { code: 11000 });
      const record = { ...structuredClone(data), _id: document.id, __v: 0, history: [] };
      rows.set(data.dedupeKey, record);
      return structuredClone(record);
    },
    findOneAndUpdate: ({ _id, __v }, update) => ({ lean: async () => {
      const record = [...rows.values()].find((item) => item._id === _id && item.__v === __v);
      if (!record) return null;
      Object.assign(record, structuredClone(update.$set));
      if (record.lastSeenAt < update.$max.lastSeenAt) record.lastSeenAt = update.$max.lastSeenAt;
      record.__v += update.$inc.__v;
      if (update.$push) record.history.push(structuredClone(update.$push.history));
      await new Supply(record).validate();
      return structuredClone(record);
    } }),
  };
  return model;
}

test("creates a candidate without inventing eligibility metadata; duplicate only advances observation times", async () => {
  const model = memoryModel();
  const created = await ingestSupply(email, { model, now: first });
  assert.equal(created.action, "created");
  assert.equal(created.record.verificationStatus, "NEEDS_REVIEW");
  assert.deepEqual(created.record.majors, []);
  assert.deepEqual(created.record.cities, []);
  assert.deepEqual(created.record.fields, []);
  assert.equal(created.record.remote, null);
  assert.equal(created.record.deadline, null);
  assert.equal(created.record.requiredDocuments, null);
  const duplicate = await ingestSupply({ ...email, lastCheckedAt: second }, { model, now: second });
  assert.equal(duplicate.action, "duplicate");
  assert.equal(duplicate.record.contentHash, created.record.contentHash);
  assert.deepEqual(duplicate.record.firstSeenAt, first);
  assert.deepEqual(duplicate.record.lastSeenAt, second);
  assert.deepEqual(duplicate.record.lastCheckedAt, second);
  assert.equal(duplicate.record.history.length, 0);
});

test("updated evidence preserves the previous source and verification, and requires a new review", async () => {
  const model = memoryModel();
  const original = await ingestSupply(verified, { model, now: first });
  const updated = await ingestSupply({ ...email, sourceUrl: "https://example.org/co-op/update", evidenceText: "Applications have reopened." }, { model, now: second });
  assert.equal(updated.action, "updated");
  assert.equal(updated.record.verificationStatus, "NEEDS_REVIEW");
  assert.deepEqual(updated.record.firstSeenAt, first);
  assert.notEqual(updated.record.contentHash, original.record.contentHash);
  assert.equal(updated.record.history[0].sourceUrl, verified.sourceUrl);
  assert.equal(updated.record.history[0].evidenceText, verified.evidenceText);
  assert.equal(updated.record.history[0].verificationStatus, "VERIFIED");
  assert.equal(updated.record.history[0].verificationReason, verified.verificationReason);
});

test("dedupes concurrent email observations while keeping distinct opportunities", async () => {
  const model = memoryModel();
  const result = await Promise.all([
    ingestSupply(email, { model, now: first }),
    ingestSupply({ ...email, companyName: "Example Training ", destinationEmail: "mailto:TRAINING@EXAMPLE.ORG" }, { model, now: first }),
  ]);
  assert.deepEqual(result.map((item) => item.action).sort(), ["created", "duplicate"]);
  assert.equal(result[0].record._id, result[1].record._id);
  await ingestSupply({ ...email, opportunityTitle: "Co-op 2027" }, { model, now: second });
  assert.equal(model.rows.size, 2);
});

test("dedupes an application URL across source sightings and keeps distinct query identifiers", async () => {
  const model = memoryModel();
  const form = { ...email, destinationEmail: undefined, channelType: "EXTERNAL_FORM", applicationUrl: "https://example.org/apply?job=1&utm_source=one" };
  const original = await ingestSupply(form, { model, now: first });
  const update = await ingestSupply({ ...form, applicationUrl: "https://EXAMPLE.ORG/apply?utm_source=two&job=1#apply", sourceUrl: "https://example.org/news" }, { model, now: second });
  assert.equal(update.action, "updated");
  assert.equal(update.record._id, original.record._id);
  await ingestSupply({ ...form, applicationUrl: "https://example.org/apply?job=2" }, { model, now: second });
  const darbak = { ...form, channelType: "DARBAK_APPLICATION", applicationUrl: undefined };
  const fromSource = await ingestSupply(darbak, { model, now: first });
  const fromSourceAgain = await ingestSupply(darbak, { model, now: second });
  assert.equal(fromSource.record._id, fromSourceAgain.record._id);
  assert.equal(model.rows.size, 3);
});

test("expires a channel on recheck and reactivates it with new verified evidence", async () => {
  const model = memoryModel();
  const opening = { ...verified, deadline: second };
  const original = await ingestSupply(opening, { model, now: first });
  const expired = await ingestSupply(opening, { model, now: second });
  assert.equal(expired.action, "expired");
  assert.equal(expired.record.isActive, false);
  assert.equal(expired.record.verificationStatus, "EXPIRED");
  const reopened = await ingestSupply({ ...opening, deadline: "2026-10-10", evidenceText: "Official page extended the deadline." }, { model, now: second });
  assert.equal(reopened.action, "reactivated");
  assert.equal(reopened.record._id, original.record._id);
  assert.equal(reopened.record.isActive, true);
  assert.equal(reopened.record.history.length, 2);
});

test("eligibility query excludes unapproved, inactive, unsupported and expired channels", async () => {
  const expected = {
    verificationStatus: "VERIFIED", isActive: true,
    channelType: { $in: ["EMAIL", "EXTERNAL_FORM", "COMPANY_PORTAL", "DARBAK_APPLICATION"] },
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: second } }] },
      { $or: [{ deadline: null }, { deadline: { $gt: second } }] },
      { $or: [{ "classification.effectiveDeadline": null }, { "classification.effectiveDeadline": { $gt: second } }] },
    ],
  };
  assert.deepEqual(eligibleSupplyFilter(second), expected);
  const good = { verificationStatus: "VERIFIED", isActive: true, channelType: "EMAIL" };
  const rows = [good, ...["LIKELY", "NEEDS_REVIEW", "REJECTED", "EXPIRED"].map((status) => ({ ...good, verificationStatus: status })),
    { ...good, expiresAt: first }, { ...good, deadline: second }, { ...good, "classification.effectiveDeadline": first },
    { ...good, isActive: false }, { ...good, channelType: "UNKNOWN" }];
  const model = { find(filter) {
    assert.deepEqual(filter, expected);
    return { sort: (sort) => {
      assert.deepEqual(sort, { _id: 1 });
      return { limit: (limit) => ({ lean: async () => rows.filter((row) => row.verificationStatus === filter.verificationStatus &&
        row.isActive === filter.isActive && filter.channelType.$in.includes(row.channelType) && filter.$and.every((condition) =>
        condition.$or.some((alternative) => Object.entries(alternative).every(([field, value]) =>
          value === null ? row[field] == null : row[field] > value.$gt)))).slice(0, limit) }) };
    } };
  } };
  assert.deepEqual(await findEligibleSupply({ model, now: second }), [good]);
  assert.throws(() => findEligibleSupply({ model, limit: 501 }), /Invalid supply query page/);
});

test("generic inboxes and HR without explicit training evidence cannot be verified", async () => {
  const model = memoryModel();
  await assert.rejects(ingestSupply({ ...verified, destinationEmail: "info@example.org" }, { model, now: first }), /not a verified training inbox/);
  await assert.rejects(ingestSupply({ ...verified, destinationEmail: "hr@example.org", emailTrainingConfirmed: undefined }, { model, now: first }), /not a verified training inbox/);
  assert.equal(model.rows.size, 0);
});

test("legacy adapter preserves documented reviewed evidence without upgrading other rows", async () => {
  const model = memoryModel();
  const channel = { company: email.companyName, email: email.destinationEmail, evidenceType: "official_training_page",
    evidenceUrl: email.sourceUrl, evidenceTextSummary: email.evidenceText, evidenceDate: first, verifiedAt: first,
    acceptsTrainingApplications: true, verificationStatus: "verified", channelType: "evergreen_training" };
  const approved = legacyEmailObservation(channel);
  assert.equal(approved.remote, null);
  assert.equal((await ingestSupply(approved, { model, now: first })).record.verificationStatus, "VERIFIED");
  assert.equal(legacyEmailObservation({ ...channel, evidenceDate: null }).verificationStatus, "NEEDS_REVIEW");
  assert.equal(legacyEmailObservation({ ...channel, verificationStatus: "likely" }).verificationStatus, "LIKELY");
  assert.equal(legacyEmailObservation({ ...channel, verificationStatus: "rejected" }).verificationStatus, "REJECTED");
  assert.throws(() => legacyEmailObservation(channel, { _id: "unrelated" }), /does not match/);
});

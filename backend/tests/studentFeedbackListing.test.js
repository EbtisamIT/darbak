const assert = require("node:assert/strict");
const { WRITTEN_FEEDBACK_PATTERN, getFeedbackListOptions, listStudentFeedback } = require("../services/studentFeedbackListing");

const pattern = new RegExp(WRITTEN_FEEDBACK_PATTERN, "iu");
const accepted = ["ممتاز", "سيئة", "لا", "سيئ", "شكراً", "bad", "good", "ما استفدت من الاشتراك", "الفرص قليلة", "أحتاج دعم أفضل", "شكراً\nلكن فيه مشكلة"];
const rejected = ["", " ", "-", ".", "...", "ا", "أ", "x", "٠١٢", "123", "😍", "ااااا", "x X x", "ـــ", "َََ"];
accepted.forEach((text) => assert.equal(pattern.test(text), true, text));
rejected.forEach((text) => assert.equal(pattern.test(text), false, text));
assert.deepEqual(getFeedbackListOptions({ tab: "all" }).filter, {});
assert.ok(getFeedbackListOptions().filter.$expr);
assert.deepEqual(getFeedbackListOptions({ tab: "published" }).filter, { publicConsent: true, published: true });
assert.equal(getFeedbackListOptions({ page: "NaN", limit: "invalid" }).page, 1);
assert.equal(getFeedbackListOptions({ page: "2", limit: "500" }).limit, 100);
assert.equal(getFeedbackListOptions({ page: "-1" }).page, 1);
assert.equal(getFeedbackListOptions({ page: "Infinity" }).page, 1);
console.log("PASS student feedback text classification and pagination options");

// Optional real Mongo regression, isolated from .env and production data.
async function testMongo() {
  const path = require("node:path");
  const mongoose = require("mongoose");
  const { MongoMemoryServer } = require(path.join(process.env.INBOX_TEST_RUNTIME, "node_modules/mongodb-memory-server"));
  const Model = require("../models/FeedbackResponse");
  const server = await MongoMemoryServer.create();
  try {
    await mongoose.connect(server.getUri(), { dbName: "feedback_listing_test" });
    await Model.create([
      ...Array.from({ length: 65 }, (_, i) => ({ rating: (i % 4) + 1, feedbackText: `${accepted[i % accepted.length]} ${i}`, publicConsent: i % 2 === 0, createdAt: new Date("2026-01-01") })),
      ...rejected.map((feedbackText) => ({ rating: 1, feedbackText, createdAt: new Date("2026-02-01") })),
      { rating: 1, originalFeedbackText: ".", feedbackText: "نص معدل", createdAt: new Date("2026-02-01") },
      { rating: 1, originalFeedbackText: "المنصة لا تعمل", feedbackText: ".", createdAt: new Date("2026-02-01") },
      { rating: 1, originalFeedbackText: "", feedbackText: "سيئة", publicConsent: true, published: true },
    ]);
    const before = JSON.stringify(await Model.find().sort({ _id: 1 }).lean());
    const first = await listStudentFeedback(Model, {});
    const second = await listStudentFeedback(Model, { page: 2 });
    const third = await listStudentFeedback(Model, { page: 3 });
    assert.equal(first.pagination.total, 67);
    assert.equal(first.rows.length, 30);
    assert.equal(second.rows.length, 30);
    assert.equal(third.rows.length, 7);
    const ids = [...first.rows, ...second.rows, ...third.rows].map((row) => String(row._id));
    assert.equal(new Set(ids).size, 67, "no lost rows or repeated rows with identical dates");
    assert.deepEqual((await listStudentFeedback(Model, {})).rows.map((row) => String(row._id)), first.rows.map((row) => String(row._id)));
    assert.equal((await listStudentFeedback(Model, { page: 999 })).pagination.page, 3);
    const all = await listStudentFeedback(Model, { tab: "all", limit: 100 });
    assert.equal(all.pagination.total, 68 + rejected.length);
    assert.ok(all.rows.some((row) => row.feedbackText === "-"));
    const publishable = await listStudentFeedback(Model, { tab: "publishable", limit: 100 });
    assert.equal(publishable.pagination.total, 33);
    const published = await listStudentFeedback(Model, { tab: "published" });
    assert.equal(published.pagination.total, 1);
    assert.equal(published.rows[0].feedbackText, "سيئة", "negative feedback is never hidden due to sentiment");
    assert.equal(JSON.stringify(await Model.find().sort({ _id: 1 }).lean()), before, "listing never mutates feedback or ratings");
    await Model.deleteMany({});
    assert.deepEqual((await listStudentFeedback(Model, { page: 3 })).pagination, { page: 1, limit: 30, total: 0, totalPages: 1 });
    console.log("PASS isolated Mongo: filtering before pagination, 67 comments across 3 pages, all responses retained, stable counts and ordering");
  } finally {
    await mongoose.disconnect();
    await server.stop();
  }
}
if (process.argv.includes("--mongo")) testMongo().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  getResumeFormFacts, getResumeFactsRevision, validateResumeFactsPatch,
  buildResumeFactsUpdate, createResumeFactsHandlers,
} = require("../services/resumeFactsBoundary");
const clone = (value) => JSON.parse(JSON.stringify(value));
const item = (id) => ({
  _id: `mongo-${id}`, id, title: "عنصر اختباري", userSourceDescription: "اشتغلت على الواجهات",
  userSourceContributions: ["اختبرت التطبيق"], description: "صياغة عربية معتمدة",
  details: "تفصيل معتمد", achievements: [{ id: `ai-${id}`, text: "طورت الواجهات واختبرت التطبيق.", html: "<p>طورت الواجهات واختبرت التطبيق.</p>" }],
});
const fixture = {
  _id: "profile", updatedAt: "2026-09-01", personalInfo: { fullName: "اختبار", phone: "0500000000", headline: "عنوان مولد" },
  summary: "نبذة عربية معتمدة", experiences: [item("exp")], projects: [item("project")], volunteering: [item("activity")],
  skills: ["SQL"], workflow: { enrichmentStates: { "project_contribution:project": { status: "answered" } } },
  localizedDisplay: { summary: "English summary" },
};
const fields = getResumeFormFacts(fixture);
assert(!fields.summary && !fields.localizedDisplay && !fields.personalInfo.headline);
for (const key of ["experiences", "projects", "volunteering"]) {
  assert.strictEqual(fields[key][0].userSourceDescription, fixture[key][0].userSourceDescription);
  assert(!fields[key][0].achievements && !fields[key][0].description && !fields[key][0].details);
}
const generatedOnly = { projects: [{ id: "p", description: "Generated English", achievements: [{ id: "ai-b", text: "Generated" }] }] };
assert.strictEqual(getResumeFormFacts(generatedOnly).projects[0].userSourceDescription, "");
assert.deepStrictEqual(getResumeFormFacts(generatedOnly).projects[0].userSourceContributions, []);
assert.strictEqual(getResumeFormFacts({ experiences: [{ id: "e", description: "كتبت التقارير" }] }).experiences[0].userSourceDescription, "كتبت التقارير");
assert.strictEqual(getResumeFormFacts({ experiences: [{ id: "e", userSourceDescription: "", description: "كتبت التقارير" }] }).experiences[0].userSourceDescription, "");
assert.deepStrictEqual(getResumeFormFacts({ experience: [item("legacy")] }).experiences.map((row) => row.id), ["legacy"]);
assert.deepStrictEqual(getResumeFormFacts({ experiences: [], experience: [item("legacy")] }).experiences, []);

const rejected = [
  { summary: "English" }, { localizedDisplay: {} }, { settings: { language: "en" } },
  { workflow: {} }, { experience: [] }, { personalInfo: { headline: "English" } },
  ...["experiences", "projects", "volunteering"].flatMap((section) => ["achievements", "description", "details", "localizedDisplay", "review"].map((field) => ({ [section]: [{ id: "x", [field]: "English" }] }))),
];
rejected.forEach((body) => assert.throws(() => validateResumeFactsPatch(body), /RESUME_FACTS_PRESENTATION_REJECTED/));
assert.throws(() => validateResumeFactsPatch({ projects: [{ id: "p" }, { id: " p " }] }), /INVALID_ITEM_ID/);
assert.throws(() => validateResumeFactsPatch({ projects: [{ id: "p", userSourceContributions: [{ text: "English" }] }] }), /INVALID/);
assert.deepStrictEqual(buildResumeFactsUpdate(fixture, { projects: [{ id: "project", userSourceDescription: "اختبرت نموذجًا جديدًا" }] }), {
  "projects.0.userSourceDescription": "اختبرت نموذجًا جديدًا",
});
assert.deepStrictEqual(buildResumeFactsUpdate(fixture, { projects: [{ id: "new", title: "جديد" }, { id: "project" }] }).projects[1], fixture.projects[0]);

async function run() {
  let persisted = clone(fixture);
  let writes = 0;
  let race = false;
  const EnglishVersion = { summary: "Approved English", projects: [{ title: "Project", achievements: ["Developed interfaces"] }] };
  const englishBefore = clone(EnglishVersion);
  const ResumeProfile = {
    findOne: () => ({ lean: async () => clone(persisted) }),
    findOneAndUpdate: (filter, update) => ({ lean: async () => {
      if (race) return null;
      assert.deepStrictEqual(filter, { _id: persisted._id, updatedAt: persisted.updatedAt });
      writes += 1;
      Object.entries(update.$set).forEach(([key, value]) => {
        const keys = key.split(".");
        const last = keys.pop();
        const target = keys.reduce((obj, part) => obj[part], persisted);
        target[last] = clone(value);
      });
      persisted.updatedAt = `saved-${writes}`;
      return clone(persisted);
    } }),
    create: () => { throw new Error("must not recreate an existing profile"); },
  };
  const handlers = createResumeFactsHandlers({ ResumeProfile });
  const call = async (method, body, version = getResumeFactsRevision(persisted)) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    await handlers[method]({ body, get: () => version, darbakAccess: { contact: "qa@example.test", accessCodeHash: "test-only" } }, res);
    return res;
  };
  for (const journey of ["EN→Review→AR", "EN→Master→Review", "refresh Review", "logout/login Review"]) {
    const before = clone(persisted);
    const res = await call("read");
    assert.deepStrictEqual(res.data.facts, getResumeFormFacts(before), journey);
    assert.strictEqual(writes, 0);
    assert.deepStrictEqual(persisted, before);
  }
  for (const body of rejected) assert.strictEqual((await call("save", body)).statusCode, 400);
  assert.strictEqual((await call("save", { personalInfo: { phone: "0511111111" } }, "")).statusCode, 428);
  assert.strictEqual(writes, 0);
  const previousVersion = getResumeFactsRevision(persisted);
  const before = clone(persisted);
  const saved = await call("save", { projects: [{ id: "project", userSourceDescription: "اختبرت نموذجًا جديدًا" }] });
  assert.strictEqual(saved.statusCode, 200);
  assert.strictEqual(writes, 1, "one edit = exactly one persistence write");
  const expected = clone(before);
  expected.projects[0].userSourceDescription = "اختبرت نموذجًا جديدًا";
  expected.updatedAt = persisted.updatedAt;
  assert.deepStrictEqual(persisted, expected, "only the source fact and server timestamp change");
  assert.deepStrictEqual(EnglishVersion, englishBefore);
  assert.strictEqual((await call("save", { personalInfo: { phone: "0511111111" } }, previousVersion)).statusCode, 409);
  assert.strictEqual(writes, 1, "delayed stale save rejected");
  await call("save", { projects: [{ id: "project", userSourceDescription: "اختبرت نموذجًا جديدًا" }] });
  assert.strictEqual(writes, 1, "same-value retry is a no-op");
  race = true;
  assert.strictEqual((await call("save", { personalInfo: { phone: "0511111111" } })).statusCode, 409);
  assert.strictEqual(writes, 1, "concurrent presentation change is never overwritten");
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert(server.includes('app.get("/api/resume/me/facts", requireResumeAccess, resumeFactsHandlers.read)'));
  assert(server.includes('app.put("/api/resume/me/facts", requireResumeAccess, resumeFactsHandlers.save)'));
  console.log("Facts ownership boundary PASS: read=0 writes, edit=1 source write, presentation unchanged, stale/broad writes rejected");
}
run().catch((err) => { console.error(err); process.exitCode = 1; });

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ai = require("../services/resumeAiService");
const architecture = require("../services/resumeArchitecture");
const normalization = require("../services/resumeFactNormalization");
const hydration = require("../services/resumePortfolioHydration");
const { normalizeResumeSkills } = require("../services/resumeSkillNormalization");
const { buildEnglishSummaryFreshness } = require("../services/resumeSummaryFreshness");

const clone = (value) => JSON.parse(JSON.stringify(value));
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
// Exercise the actual route and sanitizers without starting HTTP/Mongo or
// sending student data to a provider. Only external boundaries are doubled.
const declaration = (name) => {
  const start = source.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `${name} exists`);
  const end = source.indexOf("\nconst ", start + 1);
  assert.ok(end > start);
  return source.slice(start, end);
};
const helpers = [
  "normalizeArrayField", "sanitizePortfolioText", "sanitizePortfolioLongText",
  "sanitizePortfolioUrl", "normalizePortfolioList", "sanitizeResumeText",
  "RESUME_SECTION_KEYS", "sanitizeResumeId", "stripResumeHtml", "escapeResumeHtml",
  "sanitizeResumeRichHtml", "sanitizeResumeAchievement", "sanitizeResumeAchievements",
  "sanitizeResumeEntry", "sanitizeResumeEntries", "sanitizeResumeLanguages",
  "sanitizeResumeLinks", "sanitizeResumeSectionOrder", "sanitizeResumeSettings",
  "sanitizeResumePayload", "sanitizeResumeTranslationPayload", "buildEnglishLocalizedDisplay",
  "getEnglishVersionReadValidation", "sanitizeResumeLooseTree",
];

// Reported titles, with synthetic responsibility text and no account identifiers.
const master = {
  personalInfo: { studentStatus: "student" },
  experiences: [{
    id: "internship", title: "متدربة تطوير برمجيات",
    userSourceDescription: "طورت واجهات باستخدام React.",
    description: "تطوير واجهات باستخدام React.",
    achievements: [{ id: "task", text: "طورت واجهات باستخدام React." }],
  }],
  projects: [{
    id: "darbak", title: "دربك",
    achievements: [{ id: "project-task", text: "صممت واجهة المنصة." }],
  }],
  volunteering: [
    { id: "design", title: "مطورة برمجيات ومصممة", achievements: [{ id: "design-task", text: "صممت واجهات للنادي." }] },
    { id: "code", title: "مبرمجة", achievements: [{ id: "code-task", text: "طورت موقع النادي." }] },
  ],
  settings: { language: "ar" },
};
const before = clone(master);
let saved = null;
let writes = 0;
let providerCalls = 0;
let providerFails = false;
const client = { responses: { parse: async (request) => {
  providerCalls += 1;
  if (providerFails) throw new Error("Provider unavailable");
  const items = JSON.parse(request.input.slice(request.input.indexOf("{"))).items;
  assert.ok(items.every((item) => !item.id.endsWith(":title")), "known titles bypass AI");
  return {
    output_parsed: { translations: items.map((item) => ({ id: item.id, text: "Developed user interfaces using React." })) },
    usage: { input_tokens: 10, output_tokens: 10 },
  };
} } };
const context = vm.createContext({
  ...ai, ...architecture, ...normalization, ...hydration,
  normalizeResumeSkills, buildEnglishSummaryFreshness,
  URL, crypto: require("crypto"),
  console: { info() {}, warn() {}, error() {} },
  requireResumeAccess() {},
  getResumeAiIdempotencyKey: () => "test",
  getResumeAiCachedResponse: () => null,
  setResumeAiCachedResponse() {},
  getResumeForAccess: async () => master,
  getPortfolioForAccess: async () => ({}),
  getFrontendUrl: () => "https://example.test",
  checkResumeAiRateLimit: () => true,
  getResumeUsageSnapshot: () => ({ aiResumeUsageLimit: 5, aiResumeUsageCount: 0 }),
  translateResumeToEnglish: (args) => ai.translateResumeToEnglish({ ...args, clientOverride: client }),
  ResumeTailoredVersion: {
    findOne: () => ({ sort: () => ({ lean: async () => saved }) }),
    findOneAndUpdate: (filter, update) => ({ lean: async () => {
      writes += 1;
      saved = clone({ _id: "english-version", ...update.$set });
      return saved;
    } }),
  },
  AnalyticsEvent: { create: async () => ({}) },
  sanitizeAnalyticsText: () => "",
  sanitizeAnalyticsMetadata: () => ({}),
  serializeResume: (value) => value,
  getResumeAiErrorResponse: () => ({ status: 502, body: { error: "Translation failed" } }),
  app: { post: (route, guard, handler) => { context.handler = handler; } },
});
vm.runInContext(helpers.map(declaration).join("\n"), context);
const sanitize = vm.runInContext("sanitizeResumeTranslationPayload", context);
const oldSanitize = vm.runInContext("sanitizeResumePayload", context);
const routeStart = source.indexOf("app.post('/api/resume/ai/translate-en'");
const routeEnd = source.indexOf("\napp.", routeStart + 1);
vm.runInContext(source.slice(routeStart, routeEnd), context);

const run = async () => {
  for (const [section, title] of [["experiences", "متدربة تطوير برمجيات"], ["projects", "دربك"], ["volunteering", "مبرمجة"]]) {
    const input = { [section]: [{ id: "one", title }] };
    const items = ai.collectResumeTextForTranslation(sanitize(input));
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].sourceField, "title");
    assert.ok(items[0].id.endsWith(":title"));
    assert.strictEqual(items[0].translationType, "canonical");
    if (section === "projects") assert.strictEqual(items[0].canonicalTarget, "Darbak");

    input[section][0].description = "وصف حقيقي مستقل";
    const separate = ai.collectResumeTextForTranslation(sanitize(input));
    assert.strictEqual(separate.length, 2, "no synthesized responsibility bullet");
    const description = separate.find((item) => item.target.key === "description");
    assert.strictEqual(description.sourceField, "description");
    assert.strictEqual(description.sourceText, input[section][0].description);
    assert.strictEqual(description.fieldPath, description.key);
  }
  const legacy = ai.collectResumeTextForTranslation({ projects: [{ id: "legacy", title: "دربك", details: "وصف المشروع" }] });
  assert.strictEqual(legacy.find((item) => item.target.key === "description").sourceField, "details");

  const composed = hydration.composeCanonicalResume(master, {}, "", { language: "ar" });
  const oldItems = ai.collectResumeTextForTranslation(oldSanitize(composed));
  const items = ai.collectResumeTextForTranslation(sanitize(composed));
  assert.ok(oldItems.some((item) => item.id === "projects:darbak:description"), "old sanitizer promoted a project bullet into description");
  assert.ok(!items.some((item) => item.id === "projects:darbak:description"));
  assert.ok(!items.some((item) => item.target.section === "volunteering" && item.target.key === "description"));
  assert.strictEqual(items.filter((item) => item.target.kind === "achievement").length, 4);
  assert.ok(items.filter((item) => item.target.key === "description").every((item) => item.text !== "متدربة تطوير برمجيات"));
  items.forEach((item) => assert.strictEqual(item.sourceFieldExists, true));

  const click = async () => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    await context.handler({ body: {}, darbakAccess: { contact: "test@example.test", accessCodeHash: "test" } }, response);
    return response;
  };
  const result = await click();
  assert.strictEqual(result.statusCode, 200, JSON.stringify(result.body));
  assert.strictEqual(writes, 1);
  assert.strictEqual(providerCalls, 1);
  assert.strictEqual(result.body.diagnostics.unresolvedRequiredCount, 0);
  assert.strictEqual(result.body.diagnostics.needsEnglishRefreshAfter, false);
  assert.strictEqual(saved.resumePayload.localizedDisplay.entries["experience:internship"].title, "Software Development Intern");
  assert.strictEqual(saved.resumePayload.localizedDisplay.entries["projects:darbak"].title, "Darbak");
  assert.ok(!saved.resumePayload.localizedDisplay.entries["projects:darbak"].description);
  items.forEach((item) => assert.ok(!/[\u0600-\u06FF]/.test(ai.readTranslatedItemValue(saved.resumePayload, item)), item.id));
  assert.deepStrictEqual(master, before, "ResumeProfile / Arabic Master unchanged after English update");
  await click();
  assert.strictEqual(providerCalls, 1, "unchanged source reuses translations");
  const lastValid = clone(saved);
  master.experiences[0].description = "وصف جديد";
  const editedBefore = clone(master);
  providerFails = true;
  const writesBeforeFailure = writes;
  assert.strictEqual((await click()).statusCode, 502);
  assert.strictEqual(writes, writesBeforeFailure, "failed update stays atomic");
  assert.deepStrictEqual(saved, lastValid);
  assert.deepStrictEqual(master, editedBefore);
  console.log("Translation manifest and one-click route regression passed (mock provider/database).");
  console.log("Fixture manifest:", JSON.stringify({ before: oldItems.map((item) => item.id), after: items.map((item) => item.id) }));
};
run().catch((error) => { console.error(error); process.exitCode = 1; });

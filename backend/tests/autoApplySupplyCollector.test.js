const assert = require("node:assert/strict");
const { test } = require("node:test");
const { ingestSupply, recordSupplyRecheck } = require("../services/autoApplySupply");
const { runAutoApplySupplyDiscovery, mongoRuns } = require("../services/autoApplySupplyCollector");
const { extractPage } = require("../services/autoApplySupplyExtraction");
const { discoveryPlan, settings } = require("../services/autoApplySupplyCollectorConfig");
const { mountAutoApplySupplyCollectorRoutes, validSchedulerToken } = require("../services/autoApplySupplyCollectorRoutes");
const { canaryReadiness, canaryEnvironment } = require("../services/autoApplySupplyCanary");
const SupplyRun = require("../models/AutoApplySupplyRun");

const now = new Date("2026-11-25T06:00:00Z");
const later = new Date("2026-11-26T06:00:00Z");
const source = {
  key: "fixture", company: "Fixture Company", active: true, reviewStatus: "approved",
  sourceUrl: "https://example.org/careers/coop", sourceType: "company", atsProvider: "generic",
  officialDomains: ["example.org"], metadata: { scopes: ["https://example.org/careers/"], aliases: ["Fixture Company"] },
};
const pageHtml = ({ title = "Cooperative Training", text = "Students in Saudi Arabia may apply for co-op training.",
  email = "training@example.org", deadline = "2026-12-15", links = true } = {}) => `
    <title>${title} | Fixture Company</title>
    <main><h1>${title}</h1><p>${text}</p>
      <p>To apply for student training, send your CV to <a href="mailto:${email}">${email}</a>.</p>
      <p>For general inquiries contact info@example.org.</p>
      ${deadline ? `<p>Application deadline: ${deadline}</p>` : ""}
      ${links ? '<p><a href="https://docs.google.com/forms/d/e/fixture/viewform">Apply using the form</a></p><p><a href="/careers/apply">Apply on the company portal</a></p>' : ""}
    </main><footer>footer@example.org</footer>`;

function runStore() {
  let locked = false;
  const reports = [];
  const model = {
    init: async () => {},
    async updateOne(query, update) {
      if (query.leaseUntil) return; // No stale lease in the fixture.
      locked = false;
      reports.push(update.$set);
    },
    async create(value) {
      if (locked) throw Object.assign(new Error("Duplicate lock"), { code: 11000 });
      locked = true;
      return { ...value, _id: String(reports.length + 1) };
    },
    exists: async () => locked,
  };
  return { ...mongoRuns(model), reports };
}

function supplyStore() {
  const rows = new Map();
  const model = {
    findOne: ({ dedupeKey }) => ({ lean: async () => structuredClone(rows.get(dedupeKey) ?? null) }),
    async create(record) {
      const stored = { ...structuredClone(record), _id: String(rows.size + 1), __v: 0, history: [] };
      rows.set(record.dedupeKey, stored);
      return structuredClone(stored);
    },
    findOneAndUpdate: (filter, update) => ({ lean: async () => {
      const record = [...rows.values()].find((item) => item._id === filter._id && item.__v === filter.__v);
      if (!record) return null;
      Object.assign(record, structuredClone(update.$set || {}));
      for (const [key, date] of Object.entries(update.$max || {})) if (!record[key] || record[key] < date) record[key] = date;
      record.__v += update.$inc.__v;
      if (update.$push) record.history.push(structuredClone(update.$push.history));
      return structuredClone(record);
    } }),
  };
  return {
    rows,
    ingest: (input, options) => ingestSupply(input, { ...options, model }),
    recheck: (row, options) => recordSupplyRecheck(row, { ...options, model }),
  };
}

function fixture(options = {}) {
  const supply = supplyStore(), runs = runStore(), fetched = [], queried = [];
  const state = { html: pageHtml(), date: now, fail: false, ...options };
  const env = { AUTO_APPLY_SUPPLY_MAX_QUERIES_PER_RUN: "2", AUTO_APPLY_SUPPLY_SEARCH_QUERIES: "تدريب تعاوني\ninternship Saudi Arabia",
    AUTO_APPLY_SUPPLY_MAX_PAGES_PER_RUN: "4", ...options.env };
  const settings = {
    runs, env, clock: () => state.date, registry: async () => [source],
    readSource: () => ({ async read(url) {
      fetched.push(url);
      if (state.fail) throw Object.assign(new Error("secret that must never be returned"), { code: "HTTP_404" });
      return { status: 200, url, text: state.html, headers: { "content-type": "text/html" } };
    } }),
    searchProvider: { async search(query, config) {
      queried.push({ query, config });
      return state.results ?? [{ url: source.sourceUrl, title: "Cooperative Training at Fixture Company in Saudi Arabia" }];
    } },
    ingest: supply.ingest, recheck: supply.recheck, listDarbak: async () => [],
    listRechecks: async (limit) => [...supply.rows.values()].slice(0, limit).map((r) => structuredClone(r)),
  };
  return { supply, runs, fetched, queried, settings, state, collect: (overrides) => runAutoApplySupplyDiscovery({ ...settings, ...overrides }) };
}

test("one official page creates separate email, external form and portal channels with raw evidence", async () => {
  const f = fixture();
  const result = await f.collect();
  assert.equal(result.status, "completed");
  assert.equal(result.queries, 2);
  assert.equal(result.resultsFound, 2);
  assert.equal(result.pages, 1);
  assert.equal(result.created, 4);
  assert.equal(result.needsReview, 4);
  assert.equal(f.runs.reports[0].metrics.created, 4);
  const rows = [...f.supply.rows.values()];
  assert.equal(rows.some((row) => row.destinationEmail === "footer@example.org"), false);
  assert.equal(rows.every((row) => row.verificationStatus === "NEEDS_REVIEW"), true);
  const email = rows.find((row) => row.destinationEmail === "training@example.org");
  assert.match(email.emailEvidenceText, /apply for student training/);
  assert.equal(email.pageTitle, "Cooperative Training | Fixture Company");
  assert.ok(email.searchQuery);
  assert.equal(email.deadline.toISOString(), "2026-12-15T20:59:59.999Z");
  assert.deepEqual(email.majors, []);
  assert.deepEqual(email.cities, []);
  assert.equal(email.requiredDocuments, null);
  assert.ok(rows.some((row) => row.channelType === "EXTERNAL_FORM" && /Apply using/.test(row.applicationEvidenceText)));
  assert.ok(rows.some((row) => row.channelType === "COMPANY_PORTAL"));
  assert.equal(f.queried[0].config.freshness, "pw");
});

test("repeat and alternate search queries reuse the same record; updated evidence and separate openings are retained", async () => {
  const f = fixture();
  await f.collect();
  f.state.date = later;
  let report = await f.collect();
  assert.equal(report.created, 0);
  assert.equal(report.duplicates, 4);
  f.state.html = pageHtml({ text: "Updated instructions for students in Saudi Arabia applying for co-op training." });
  report = await f.collect();
  assert.equal(report.updated, 4);
  assert.equal([...f.supply.rows.values()].filter((row) => row.history.length === 1).length, 4);
  f.state.html = pageHtml({ title: "Internship for students", email: "alternate@example.org", links: false });
  report = await f.collect();
  assert.equal(report.created, 2);
  f.state.html = pageHtml({ email: "other-coop@example.org" });
  report = await f.collect();
  assert.equal(report.created, 1);
  assert.equal(f.supply.rows.size, 7);
});

test("deadline expires even if source goes missing, preserves last seen/evidence, and can reopen", async () => {
  const f = fixture({ html: pageHtml({ deadline: "2026-11-25" }) });
  await f.collect();
  f.state.date = later;
  f.state.fail = true;
  const unavailable = await f.collect();
  assert.equal(unavailable.status, "partial");
  assert.equal(unavailable.expired, 4);
  assert.doesNotMatch(JSON.stringify(unavailable), /secret that/);
  for (const row of f.supply.rows.values()) {
    assert.equal(row.verificationStatus, "EXPIRED");
    assert.equal(row.isActive, false);
    assert.deepEqual(row.lastSeenAt, now);
    assert.deepEqual(row.lastCheckedAt, later);
    assert.equal(row.history[0].verificationStatus, "NEEDS_REVIEW");
    assert.match(row.evidenceText, /training/);
  }
  f.state.fail = false;
  f.state.html = pageHtml({ deadline: "2026-12-15" });
  const reopened = await f.collect();
  assert.equal(reopened.reactivated, 4);
  assert.equal(reopened.created, 0);
  assert.equal([...f.supply.rows.values()].every((row) => row.isActive && row.verificationStatus === "NEEDS_REVIEW"), true);
});

test("page failure cannot expire a record with no deadline or overwrite its evidence", async () => {
  const f = fixture({ html: pageHtml({ deadline: null, links: false }) });
  await f.collect();
  f.state.date = later;
  f.state.fail = true;
  assert.equal((await f.collect()).status, "partial");
  const row = [...f.supply.rows.values()][0];
  assert.equal(row.verificationStatus, "NEEDS_REVIEW");
  assert.equal(row.history.length, 0);
  assert.deepEqual(row.lastSeenAt, now);
  assert.deepEqual(row.lastCheckedAt, later);
});

test("search-only leads stay unverified and unapproved hosts are never fetched", async () => {
  const lead = { url: "https://example.net/unverified", title: "Internship at Fixture Company",
    description: "Students in Saudi Arabia may apply for internship: training@example.org." };
  const f = fixture({ html: "<title>Careers</title>", results: [lead] });
  const result = await f.collect();
  assert.equal(result.created, 1);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(f.fetched, [source.sourceUrl]);
  const row = [...f.supply.rows.values()][0];
  assert.equal(row.sourceType, "search_engine_discovery");
  assert.equal(row.verificationStatus, "NEEDS_REVIEW");
  assert.match(row.emailEvidenceText, /may apply/);
  assert.ok(row.searchQuery);
  f.state.html = pageHtml({ title: "Internship at Fixture Company", links: false });
  await f.collect();
  const upgraded = [...f.supply.rows.values()].find((item) => item.destinationEmail === "training@example.org");
  assert.equal(upgraded.sourceType, "official_careers_page");
  f.state.html = "<title>Careers</title>";
  await f.collect();
  assert.equal([...f.supply.rows.values()].find((item) => item.destinationEmail === "training@example.org").sourceType,
    "official_careers_page");
});

test("remote collection needs explicit Saudi applicants and shared portals keep separate programs", () => {
  const fromPage = (html, url = source.sourceUrl) => extractPage({ url, text: html }, source);
  const unrelated = pageHtml({ title: "Remote Internship", text: "Remote internship in Canada. Our headquarters are in Saudi Arabia." });
  assert.deepEqual(fromPage(unrelated), []);
  const accepted = pageHtml({ title: "Remote Internship", text: "This remote internship is open to applicants based in Saudi Arabia." });
  assert.equal(fromPage(accepted).every((item) => item.remote === true), true);
  assert.ok(fromPage(accepted).length);
  const coop = fromPage(pageHtml()).find((item) => item.channelType === "COMPANY_PORTAL");
  const graduate = fromPage(pageHtml({ title: "Graduate Development Program",
    text: "Graduate training and rotations in Saudi Arabia." })).find((item) => item.channelType === "COMPANY_PORTAL");
  assert.equal(graduate.trainingType, "graduate");
  assert.notEqual(coop.opportunityId, graduate.opportunityId);
});

test("student and summer programs use only the program title and explicit application channel", () => {
  const html = (title, description) => '<title>' + title + '</title><main><h1>' + title + '</h1><p>' + description +
    '</p><p><a href="https://darbak.space/where-to-train/opportunity/fixture">Apply on Darbak</a></p></main>';
  for (const [title, description, type] of [
    ["University Student Program", "Practical training for university students in Saudi Arabia", "student_program"],
    ["برنامج التدريب الصيفي", "تدريب لطلاب الجامعات في السعودية", "summer"],
  ]) {
    const channels = extractPage({ url: source.sourceUrl, text: html(title, description) }, source);
    assert.equal(channels.length, 1);
    assert.equal(channels[0].trainingType, type);
    assert.equal(channels[0].channelType, "DARBAK_APPLICATION");
  }
});

test("run lock excludes overlaps and releases after failure", async () => {
  const f = fixture();
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const first = f.collect({ registry: () => blocked });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await f.collect(), { status: "already_running" });
  release(null);
  assert.equal((await first).status, "failed");
  assert.equal((await f.collect()).status, "completed");
});

test("query, page and new limits are enforced; preview never acquires lock or writes", async () => {
  const f = fixture({ env: { AUTO_APPLY_SUPPLY_MAX_QUERIES_PER_RUN: "1",
    AUTO_APPLY_SUPPLY_MAX_PAGES_PER_RUN: "1", AUTO_APPLY_SUPPLY_MAX_NEW_CANDIDATES_PER_RUN: "2" } });
  const report = await f.collect();
  assert.equal(report.queries, 1);
  assert.equal(report.pages, 1);
  assert.equal(report.created, 2);
  assert.equal(report.limited, 2);
  const second = await f.collect();
  assert.equal(second.created, 2);
  const preview = await f.collect({ preview: true, registry: f.settings.registry, runs: { acquire: assert.fail }, ingest: assert.fail });
  assert.equal(preview.created, 0);
  assert.equal(preview.uniqueCandidates, 4);
});

test("schedule routes default off and require the configured token or existing admin middleware", async () => {
  const routes = new Map();
  const app = { post: (path, ...handlers) => routes.set(path, handlers), get: (path, ...handlers) => routes.set(path, handlers) };
  const key = "x".repeat(40);
  const env = { AUTO_APPLY_SUPPLY_COLLECTOR_TOKEN: key };
  const requireAdmin = (_req, res) => res.sendStatus(403);
  let runs = 0;
  mountAutoApplySupplyCollectorRoutes(app, requireAdmin, { env, isConnected: () => true,
    run: async () => { runs += 1; return { status: "completed" }; } });
  async function call(path, token) {
    const req = { get: () => token };
    const res = { code: 200, set() {}, status(code) { this.code = code; return this; },
      sendStatus(code) { this.code = code; }, json() {} };
    const handlers = routes.get(path);
    let index = 0;
    const next = () => handlers[index++](req, res, next);
    await next();
    return res.code;
  }
  const internal = "/api/internal/auto-apply-supply/run";
  assert.equal(validSchedulerToken("Bearer weak", "weak"), false);
  assert.equal(await call(internal, "Bearer " + key), 404);
  env.AUTO_APPLY_SUPPLY_COLLECTOR_ENABLED = "true";
  assert.equal(await call(internal), 401);
  assert.equal(await call("/api/admin/auto-apply-supply/run", "Bearer " + key), 403);
  assert.equal(await call(internal, "Bearer " + key), 200);
  assert.equal(runs, 1);
});

test("watchlist reuses the approved Darbak names; bilingual plans include graduate and student programs", () => {
  const plan = discoveryPlan(settings({ AUTO_APPLY_SUPPLY_MAX_QUERIES_PER_RUN: "24" }), undefined, now);
  assert.ok(["stc", "aramco", "sabic", "mobily", "elm", "snb", "saudia", "jarir", "pwc", "alrajhi"]
    .every((key) => plan.sources.some((s) => s.key === key)));
  assert.ok(plan.queries.some((q) => /تدريب/.test(q)));
  assert.ok(plan.queries.some((q) => /graduate/.test(q)));
  assert.ok(plan.queries.some((q) => /university student|طلاب الجامعات/.test(q)));
});

test("classifier sees records after ingestion and failures do not undo collector writes; preview never classifies", async () => {
  const f = fixture({ env: { AUTO_APPLY_SUPPLY_AI_ENABLED: "true" } });
  let calls = 0;
  const classifyBatch = async () => {
    calls += 1;
    assert.equal(f.supply.rows.size, 4);
    throw new Error("provider private payload");
  };
  const report = await f.collect({ classifyBatch });
  assert.equal(report.status, "partial");
  assert.equal(report.created, 4);
  assert.deepEqual(report.errorCodes, [{ stage: "classification", code: "COLLECTOR_STEP_FAILED" }]);
  assert.equal(calls, 1);
  await f.collect({ classifyBatch, preview: true, registry: f.settings.registry });
  assert.equal(calls, 1);
});

test("canary uses fixed caps, skips legacy imports and scopes AI to freshly inserted candidate IDs", async () => {
  const f = fixture();
  await f.collect();
  f.state.html = pageHtml({ email: "new-training@example.org" });
  let ids;
  const result = await f.collect({ trigger: "canary", canarySlot: 1, env: canaryEnvironment(f.settings.env),
    listDarbak: assert.fail, listRechecks: assert.fail, selectLegacy: assert.fail,
    classifyBatch: async ({ candidateIds }) => { ids = candidateIds; },
  });
  assert.equal(result.created, 1);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.fetchFailures, 0);
  assert.equal(result.rawCandidates, 4);
  assert.equal(result.stages.relevantPrograms, 1);
  assert.equal(result.stages.pageChannels, 4);
  assert.equal(result.stages.ingestionFailures, 0);
  assert.deepEqual(ids, [[...f.supply.rows.values()].find((row) => row.destinationEmail === "new-training@example.org")._id]);
  assert.equal(SupplyRun.schema.indexes().some(([index, options]) => index.canarySlot === 1 && options.unique === true), true);
  const settingsForCanary = settings(canaryEnvironment({ AUTO_APPLY_SUPPLY_MAX_QUERIES_PER_RUN: "50" }));
  assert.deepEqual([settingsForCanary.maxQueries, settingsForCanary.maxPages, settingsForCanary.maxNew], [8, 16, 25]);
  assert.equal(canaryEnvironment({}).AUTO_APPLY_SUPPLY_MAX_AI_CLASSIFICATIONS_PER_RUN, "10");
  const first = { canarySlot: 1, finishedAt: now, metrics: { resultsFound: 10, uniqueCandidates: 0 } };
  assert.equal(canaryReadiness({}, []).nextSlot, 1);
  assert.equal(canaryReadiness({}, [first]).nextSlot, null);
  const approvedRetry = { AUTO_APPLY_SUPPLY_CANARY_RETRY_ENABLED: "true" };
  assert.equal(canaryReadiness(approvedRetry, [first]).nextSlot, 2);
  assert.equal(canaryReadiness(approvedRetry, [first, { canarySlot: 2 }]).nextSlot, null);
  assert.equal(canaryReadiness(approvedRetry, [{ ...first, metrics: { resultsFound: 10, uniqueCandidates: 1 } }]).nextSlot, null);
});

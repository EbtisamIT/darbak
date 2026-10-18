const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const publicStart = source.indexOf("app.post('/api/opportunities'");
const adminStart = source.indexOf("app.post('/api/admin/opportunities'");
assert(publicStart >= 0 && adminStart >= 0);
const routeSource = [
  source.slice(publicStart, source.indexOf("// إنشاء تجربة", publicStart)),
  source.slice(adminStart, source.indexOf("app.patch('/api/admin/experiences", adminStart)),
].join("\n");

const routes = new Map();
const created = [];
const updates = [];
vm.runInNewContext(routeSource, {
  app: {
    post: (route, ...handlers) => routes.set(`POST ${route}`, handlers.at(-1)),
    patch: (route, ...handlers) => routes.set(`PATCH ${route}`, handlers.at(-1)),
  },
  requireAdmin: () => {},
  mongoose: { connection: { readyState: 1 } },
  sanitizeOpportunityPayload: (body) => ({ ...body, cities: body.cities || [],
    majorCategories: body.majorCategories || [], specialties: body.specialties || [] }),
  hydrateDarbakOpportunityFromCampaign: async (payload) => payload,
  containsBlockedTerms: (value) => String(value || "").includes("حيوان"),
  Opportunity: {
    create: async (payload) => { created.push(payload); return payload; },
    findByIdAndUpdate: (id, update) => ({ lean: async () => {
      updates.push({ id, update });
      return { _id: id, ...update.$set };
    } }),
  },
  console,
});

const response = () => ({
  code: 200,
  body: null,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});

(async () => {
  const payload = { organizationName: "جهة تدريب", title: "تدريب الإنتاج الحيواني",
    specialties: ["الإنتاج الحيواني"], city: "الرياض", cities: ["الرياض"] };

  const adminCreate = response();
  await routes.get("POST /api/admin/opportunities")({ body: payload }, adminCreate);
  assert.equal(adminCreate.code, 200);
  assert.equal(created.length, 1);
  assert.equal(created[0].title, payload.title);

  const adminEdit = response();
  await routes.get("PATCH /api/admin/opportunities/:id")({ body: payload, params: { id: "test-id" } }, adminEdit);
  assert.equal(adminEdit.code, 200);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].update.$set.title, payload.title);

  const visitorCreate = response();
  await routes.get("POST /api/opportunities")({ body: payload }, visitorCreate);
  assert.equal(visitorCreate.code, 400);
  assert.equal(created.length, 1, "visitor moderation remains active");

  console.log("Admin opportunity moderation PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const pause = require("../services/resumeEnglishUpdateSafety");

let nextCalls = 0;
const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
pause({ method: "POST" }, res, () => { nextCalls += 1; });
assert.strictEqual(nextCalls, 1, "English updates pass to the authenticated route");
pause({ method: "OPTIONS" }, res, () => { nextCalls += 1; });
assert.strictEqual(nextCalls, 2);
pause({ method: "POST", resumeEnglishQaVerified: true }, res, () => { nextCalls += 1; });
assert.strictEqual(nextCalls, 3);
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const gate = source.indexOf('app.use("/api/resume/ai/translate-en", async (req, res, next) => {');
assert.ok(gate >= 0 && gate < source.indexOf("app.post('/api/resume/ai/translate-en'"), "safety boundary runs before the authenticated route");
assert.ok(source.includes('return require("./services/resumeEnglishUpdateSafety")(req, res, next);'));
console.log("English update release gate: PASS (authenticated route reachable)");

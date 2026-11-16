const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { createAccessAttemptLimiter, createAccessAttemptMiddleware, clientIp, THROTTLED_MESSAGE } =
  require("../services/accessAttemptLimiter");

// Existing accounts: contact -> correct code. Unknown contacts are new sign-ups.
const accounts = { "student@example.com": "Ab1234", "other@example.com": "Zz9999" };

function harness(options = {}) {
  let clock = 1_000_000;
  let classifyCalls = 0;
  const limiter = createAccessAttemptLimiter({ now: () => clock, ...options });
  const middleware = createAccessAttemptMiddleware({
    limiter,
    hash: (contact, code) => `${contact}|${code}`,
    resolveIdentity: (req) => (req.body.contact && req.body.accessCode
      ? { contact: req.body.contact, accessCode: req.body.accessCode } : null),
    classify: async ({ contact, accessCode }) => {
      classifyCalls += 1;
      if (!(contact in accounts)) return "new";
      return accounts[contact] === accessCode ? "match" : "miss";
    },
  });
  const call = async (contact, accessCode, ip = "203.0.113.5") => {
    const res = { statusCode: 200, headers: {}, body: null,
      set(name, value) { this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; } };
    const req = { body: { contact, accessCode }, get: (name) => (name === "x-forwarded-for" ? ip : ""), socket: {} };
    let passed = false;
    await middleware(req, res, (error) => { if (error) throw error; passed = true; });
    return { passed, res };
  };
  return { call, advance: (ms) => { clock += ms; }, classifyCalls: () => classifyCalls };
}

async function run() {
  // Accepted: requests without an access identity are not touched.
  {
    const h = harness();
    assert.equal((await h.call("", "")).passed, true);
    assert.equal(h.classifyCalls(), 0);
  }

  // Accepted: correct codes are never counted, and are cached to avoid extra DB reads.
  {
    const h = harness();
    for (let i = 0; i < 20; i += 1) assert.equal((await h.call("student@example.com", "Ab1234")).passed, true);
    assert.equal(h.classifyCalls(), 1);
  }

  // Accepted: brand new contacts (first sign-up) never count as misses.
  {
    const h = harness();
    for (let i = 0; i < 20; i += 1) assert.equal((await h.call(`new${i}@example.com`, "Qq1111")).passed, true);
    assert.equal((await h.call("new0@example.com", "Qq2222")).passed, true);
  }

  // Rejected: wrong codes on an existing contact pause that contact.
  {
    const h = harness();
    for (let i = 0; i < 8; i += 1) assert.equal((await h.call("student@example.com", `Bad${i}00`)).passed, true);
    const blocked = await h.call("student@example.com", "Bad999");
    assert.equal(blocked.passed, false);
    assert.equal(blocked.res.statusCode, 429);
    assert.equal(blocked.res.body.error, THROTTLED_MESSAGE);
    assert.equal(blocked.res.body.reason, "access_code_attempts_exceeded");
    assert(Number(blocked.res.headers["Retry-After"]) > 0);

    // The correct code is paused too, so the 429 cannot reveal a right guess.
    assert.equal((await h.call("student@example.com", "Ab1234")).res.statusCode, 429);
    // Other students are not affected by this contact's pause (different IP).
    assert.equal((await h.call("other@example.com", "Zz9999", "198.51.100.7")).passed, true);

    // The pause ends after the window; the owner can sign in again.
    h.advance(15 * 60 * 1000 + 1);
    assert.equal((await h.call("student@example.com", "Ab1234")).passed, true);
  }

  // Rejected: one IP spraying one code across many existing contacts.
  {
    const extra = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`spray${i}@example.com`, "Right1"]));
    Object.assign(accounts, extra);
    const h = harness();
    for (let i = 0; i < 30; i += 1) await h.call(`spray${i}@example.com`, "1234", "192.0.2.9");
    const blocked = await h.call("spray35@example.com", "1234", "192.0.2.9");
    assert.equal(blocked.res.statusCode, 429);
    // A different IP is unaffected.
    assert.equal((await h.call("spray36@example.com", "Right1", "192.0.2.10")).passed, true);
  }

  // Misses spread out over time do not accumulate past the window.
  {
    const h = harness();
    for (let round = 0; round < 3; round += 1) {
      for (let i = 0; i < 7; i += 1) await h.call("other@example.com", `Wrong${i}`);
      h.advance(15 * 60 * 1000 + 1);
    }
    assert.equal((await h.call("other@example.com", "Zz9999")).passed, true);
  }

  assert.equal(clientIp({ get: () => "203.0.113.1, 10.0.0.1", socket: {} }), "203.0.113.1");
  assert.equal(clientIp({ get: () => "", socket: { remoteAddress: "127.0.0.1" } }), "127.0.0.1");

  // The server applies the guard to every API route, without editing accounts.
  const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert(server.includes('app.use("/api", createAccessAttemptMiddleware({'));
  const limiterSource = fs.readFileSync(path.join(__dirname, "../services/accessAttemptLimiter.js"), "utf8");
  assert(!/User\.(update|findOneAndUpdate|save)|accessCodeHash\s*=/.test(limiterSource));

  console.log("Access attempt limiter tests passed");
}

run().catch((error) => { console.error(error); process.exit(1); });

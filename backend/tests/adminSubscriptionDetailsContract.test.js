const assert = require("assert");
const fs = require("fs");
const path = require("path");

const serverSource = fs.readFileSync(
  path.join(__dirname, "..", "server.js"),
  "utf8"
);
const routeStart = serverSource.indexOf(
  "app.get('/api/admin/subscriptions/:id'"
);
const routeEnd = serverSource.indexOf(
  "app.patch('/api/admin/subscriptions/:id'",
  routeStart
);
const routeSource = serverSource.slice(routeStart, routeEnd);

assert.ok(routeStart >= 0, "admin subscriber details route must exist");
assert.ok(routeEnd > routeStart, "admin subscriber details route must be bounded");
assert.match(
  routeSource,
  /const startedAt = subscription\.startsAt \|\| subscription\.createdAt \|\| null;/,
  "route must resolve a safe subscription start date"
);
assert.match(
  routeSource,
  /startsAt: startedAt,/,
  "response must use the resolved start date without an undefined variable"
);
assert.doesNotMatch(
  routeSource,
  /^\s*startsAt,\s*$/m,
  "response must not reference an undeclared startsAt variable"
);

console.log("admin subscription details contract tests passed");

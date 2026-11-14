const assert = require("node:assert/strict");
const {
  AUTO_EXPIRE_REASONS,
  getFreshnessConfig,
  getOpportunityCheckUrl,
  checkOpportunityLink,
  decideOpportunityFreshness,
  getAdminReactivationFreshness,
  runOpportunityFreshnessSweep,
} = require("../services/opportunityFreshness");

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-14T09:00:00Z");
const daysAgo = (days) => new Date(now.getTime() - days * DAY);
const config = getFreshnessConfig({});
const html = (body) => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, text: `<html><body>${body}</body></html>` });
const fakeTransport = (routes) => async (url) => {
  const route = routes[url.href];
  if (!route) throw Object.assign(new Error("not found"), { code: "UNEXPECTED_URL" });
  if (route instanceof Error) throw route;
  return route;
};

async function main() {
  // Which link is checked.
  assert.equal(getOpportunityCheckUrl({ applicationUrl: "http://careers.example/job/1" }), "https://careers.example/job/1");
  assert.equal(getOpportunityCheckUrl({ applicationUrl: "mailto:hr@example.com", sourceUrl: "https://example.com/post" }), "https://example.com/post");
  assert.equal(getOpportunityCheckUrl({ applicationUrl: "not a url" }), "");
  assert.equal(getOpportunityCheckUrl({ applicationUrl: "https://darbak.space/apply/x", isDarbakApplication: true }), "");
  assert.equal(getOpportunityCheckUrl({ applicationUrl: "https://x.example/a", applicationMethod: "darbak" }), "");
  assert.equal(getOpportunityCheckUrl({ applicationUrl: "https://user:pw@x.example/a" }), "");

  // Link check results: anything unreadable is "unknown", never "closed".
  const job = "https://careers.example/jobs/coop-2026";
  const check = (routes) => checkOpportunityLink(job, { transport: fakeTransport(routes) });
  assert.deepEqual(await check({ [job]: html("<h1>Co-op program</h1><a>Apply now</a>") }), { result: "open", reason: "OK" });
  assert.deepEqual(await check({ [job]: html("<p>عذرًا، انتهى التقديم على هذا البرنامج</p>") }), { result: "closed", reason: "CLOSED_TEXT" });
  assert.deepEqual(await check({ [job]: html("<p>No longer accepting applications</p>") }), { result: "closed", reason: "CLOSED_TEXT" });
  assert.deepEqual(await check({ [job]: { status: 404, headers: {}, text: "" } }), { result: "closed", reason: "HTTP_404" });
  assert.deepEqual(await check({ [job]: { status: 410, headers: {}, text: "" } }), { result: "closed", reason: "HTTP_410" });
  assert.deepEqual(await check({ [job]: { status: 403, headers: {}, text: "" } }), { result: "unknown", reason: "HTTP_403" });
  assert.deepEqual(await check({ [job]: { status: 999, headers: {}, text: "" } }), { result: "unknown", reason: "HTTP_999" });
  assert.deepEqual(await check({ [job]: Object.assign(new Error("t"), { code: "REQUEST_TIMEOUT" }) }), { result: "unknown", reason: "REQUEST_TIMEOUT" });
  assert.deepEqual(await check({ [job]: Object.assign(new Error("n"), { code: "NON_PUBLIC_ADDRESS" }) }), { result: "unknown", reason: "NON_PUBLIC_ADDRESS" });
  // Closed text inside a PDF/binary response is ignored.
  assert.deepEqual(await check({ [job]: { status: 200, headers: { "content-type": "application/pdf" }, text: "applications closed" } }), { result: "open", reason: "OK" });
  // Redirects are followed and upgraded to https; a bounce to the home page is not proof.
  assert.deepEqual(await check({
    [job]: { status: 301, headers: { location: "http://careers.example/jobs/coop-2026-v2" } },
    "https://careers.example/jobs/coop-2026-v2": html("Applications are closed"),
  }), { result: "closed", reason: "CLOSED_TEXT" });
  assert.deepEqual(await check({ [job]: { status: 302, headers: { location: "/" } } }), { result: "unknown", reason: "REDIRECTED_TO_HOMEPAGE" });
  assert.deepEqual(await check({ [job]: { status: 302, headers: { location: "javascript:alert(1)" } } }), { result: "unknown", reason: "UNSAFE_REDIRECT" });
  assert.deepEqual(await check({ [job]: { status: 302, headers: {} } }), { result: "unknown", reason: "REDIRECT_LIMIT" });

  // Decisions.
  const fresh = { createdAt: daysAgo(10), freshness: {} };
  const closedOnce = decideOpportunityFreshness(fresh, { result: "closed", reason: "CLOSED_TEXT" }, { now, config });
  assert.equal(closedOnce.expire, false, "one closed check is not enough");
  assert.equal(closedOnce.set["freshness.closedStreak"], 1);
  assert.equal(closedOnce.set.status, undefined);

  const closedTwice = decideOpportunityFreshness(
    { createdAt: daysAgo(10), freshness: { closedStreak: 1 } },
    { result: "closed", reason: "CLOSED_TEXT" },
    { now, config }
  );
  assert.equal(closedTwice.expire, true);
  assert.equal(closedTwice.reason, AUTO_EXPIRE_REASONS.PAGE_CLOSED);
  assert.equal(closedTwice.set.status, "expired");
  assert.equal(closedTwice.set["freshness.autoExpiredReason"], "page_closed");

  assert.equal(decideOpportunityFreshness(
    { createdAt: daysAgo(10), freshness: { closedStreak: 1 } },
    { result: "closed", reason: "HTTP_404" },
    { now, config }
  ).reason, AUTO_EXPIRE_REASONS.PAGE_MISSING);

  // An open (or unknown) result breaks the closed streak.
  assert.equal(decideOpportunityFreshness({ createdAt: daysAgo(10), freshness: { closedStreak: 1 } }, { result: "open", reason: "OK" }, { now, config }).set["freshness.closedStreak"], 0);
  assert.equal(decideOpportunityFreshness({ createdAt: daysAgo(10), freshness: { closedStreak: 1 } }, { result: "unknown", reason: "HTTP_403" }, { now, config }).set["freshness.closedStreak"], 0);

  // No deadline + old + not confirmed open recently → stale.
  const stale = decideOpportunityFreshness({ createdAt: daysAgo(50), freshness: {} }, { result: "unknown", reason: "NO_LINK" }, { now, config });
  assert.equal(stale.reason, AUTO_EXPIRE_REASONS.STALE_UNVERIFIED);
  assert.equal(decideOpportunityFreshness({ createdAt: daysAgo(44), freshness: {} }, { result: "unknown", reason: "NO_LINK" }, { now, config }).expire, false);
  // Old but the link is open now, or was open a few days ago → kept.
  assert.equal(decideOpportunityFreshness({ createdAt: daysAgo(90), freshness: {} }, { result: "open", reason: "OK" }, { now, config }).expire, false);
  assert.equal(decideOpportunityFreshness({ createdAt: daysAgo(90), freshness: { lastOpenAt: daysAgo(3) } }, { result: "unknown", reason: "REQUEST_TIMEOUT" }, { now, config }).expire, false);
  assert.equal(decideOpportunityFreshness({ createdAt: daysAgo(90), freshness: { lastOpenAt: daysAgo(8) } }, { result: "unknown", reason: "REQUEST_TIMEOUT" }, { now, config }).expire, true);
  // Opportunities with a deadline are left to the existing deadline sweep.
  assert.equal(decideOpportunityFreshness({ createdAt: daysAgo(90), deadline: daysAgo(-20), freshness: {} }, { result: "unknown", reason: "NO_LINK" }, { now, config }).expire, false);

  // Admin reopened it recently → never auto-closed, even with closed checks.
  const kept = decideOpportunityFreshness(
    { createdAt: daysAgo(90), freshness: { closedStreak: 5, adminKeptAt: daysAgo(10) } },
    { result: "closed", reason: "CLOSED_TEXT" },
    { now, config }
  );
  assert.equal(kept.expire, false);
  assert.equal(decideOpportunityFreshness(
    { createdAt: daysAgo(90), freshness: { closedStreak: 1, adminKeptAt: daysAgo(31) } },
    { result: "closed", reason: "CLOSED_TEXT" },
    { now, config }
  ).expire, true, "admin protection expires after 30 days");

  // Config comes from env with safe fallbacks.
  assert.equal(getFreshnessConfig({ OPPORTUNITY_MAX_AGE_WITHOUT_DEADLINE_DAYS: "60" }).maxAgeWithoutDeadlineDays, 60);
  assert.equal(getFreshnessConfig({ OPPORTUNITY_MAX_AGE_WITHOUT_DEADLINE_DAYS: "-1" }).maxAgeWithoutDeadlineDays, 45);

  // Admin reactivation.
  const reset = getAdminReactivationFreshness({ status: "expired", freshness: { autoExpiredAt: daysAgo(1) } }, "active", now);
  assert.deepEqual(reset, {
    "freshness.adminKeptAt": now,
    "freshness.closedStreak": 0,
    "freshness.autoExpiredAt": null,
    "freshness.autoExpiredReason": "",
  });
  assert.equal(getAdminReactivationFreshness({ status: "expired", freshness: {} }, "active", now), null, "manually expired ones are not affected");
  assert.equal(getAdminReactivationFreshness({ status: "active", freshness: { autoExpiredAt: daysAgo(1) } }, "active", now), null);
  assert.equal(getAdminReactivationFreshness({ status: "expired", freshness: { autoExpiredAt: daysAgo(1) } }, "draft", now), null);
  assert.equal(getAdminReactivationFreshness(null, "active", now), null);

  // Sweep: picks a batch, checks it and only updates still-active documents.
  const docs = [
    { _id: "a", applicationUrl: job, createdAt: daysAgo(5), freshness: { closedStreak: 1 } },
    { _id: "b", applicationUrl: "https://careers.example/open", createdAt: daysAgo(100), freshness: {} },
    { _id: "c", applicationMethod: "email", createdAt: daysAgo(60), freshness: {} },
    { _id: "d", applicationUrl: "https://careers.example/edited", createdAt: daysAgo(100), freshness: {} },
  ];
  let findQuery, findLimit;
  const updates = [];
  const Opportunity = {
    find(query) {
      findQuery = query;
      const chain = {
        sort: () => chain,
        limit: (value) => { findLimit = value; return chain; },
        select: () => chain,
        lean: async () => docs,
      };
      return chain;
    },
    async updateOne(filter, update) {
      updates.push({ filter, update });
      // "d" was edited by an admin while the check ran.
      return { matchedCount: filter._id === "d" ? 0 : 1 };
    },
  };
  const summary = await runOpportunityFreshnessSweep({
    Opportunity,
    now,
    config: { ...config, concurrency: 2 },
    transport: fakeTransport({
      [job]: html("التقديم مغلق"),
      "https://careers.example/open": html("Apply now"),
      "https://careers.example/edited": html("Apply now"),
    }),
    logger: { error() {} },
  });
  assert.equal(findQuery.status, "active");
  assert.deepEqual(findQuery.isDarbakApplication, { $ne: true });
  assert.deepEqual(findQuery.applicationMethod, { $ne: "darbak" });
  assert.equal(findLimit, config.batchSize);
  assert.equal(updates.length, 4);
  assert.ok(updates.every(({ filter }) => filter.status === "active"));
  assert.deepEqual(
    { checked: summary.checked, open: summary.open, closed: summary.closed, unknown: summary.unknown, expired: summary.expired },
    { checked: 3, open: 1, closed: 1, unknown: 1, expired: 2 }
  );
  assert.deepEqual(summary.expiredIds.sort(), ["a", "c"]);
  assert.equal(updates.find(({ filter }) => filter._id === "a").update.$set["freshness.autoExpiredReason"], "page_closed");
  assert.equal(updates.find(({ filter }) => filter._id === "c").update.$set["freshness.autoExpiredReason"], "stale_unverified");
  assert.equal(updates.find(({ filter }) => filter._id === "b").update.$set.status, undefined);

  console.log("opportunityFreshness tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

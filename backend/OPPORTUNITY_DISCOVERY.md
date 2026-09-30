# Opportunity Discovery v1

Manual, deterministic discovery into the existing Opportunity Inbox. No AI calls,
cron, public UI changes, external social sources, auto-publication, or Opportunity
updates. Candidate ingestion always calls `createOpportunityCandidate()`.

## Files

- Models: `models/OpportunitySource.js`, `models/OpportunityDiscoveryRun.js`.
- Registry: `services/opportunityDiscovery/sources.js`.
- Network boundary: `services/opportunityDiscovery/http.js`.
- HTML/JSON-LD facts: `services/opportunityDiscovery/extract.js`.
- Adapters: `services/opportunityDiscovery/adapters.js`.
- Freshness and scoring: `services/opportunityDiscovery/verification.js`.
- Bounded orchestration: `services/opportunityDiscovery/pipeline.js`.
- Persistence/manual-run lifecycle: `services/opportunityDiscovery/service.js`.
- Admin integration: `services/opportunityCandidateRoutes.js`.
- Read-only smoke: `scripts/discoverOpportunities.js`.
- Tests: `tests/opportunityDiscovery.test.js`, `tests/opportunityDiscovery.integration.js`.
- Existing integration preview: configurable `INBOX_PREVIEW_PORT` and listen error handling.
- Frontend: `src/components/opportunityInbox/DiscoveryPanel.jsx`, its test,
  `OpportunityInbox.jsx`, `OpportunityInbox.css`.
- Backend package/lock: cheerio, ipaddr.js, robots-parser; test/check scripts.

## Reviewed pilot sources

These are source pages, **not assertions that applications are open**. Official
pages were inspected on 2026-09-29; active opportunities can legitimately be zero.
The source country never becomes an inferred job city/country.

| Key | Company/sector | Official reference/source |
| --- | --- | --- |
| stc | STC / telecom | https://careers.stc.com.sa/content/COOP/?locale=en_US |
| aramco | Saudi Aramco / energy | https://www.aramco.com/en/careers/for-saudi-applicants/student-opportunities/university-and-vocational-college-internship-programs |
| sabic | SABIC / industry | https://www.sabic.com/en/careers |
| mobily | Mobily / telecom | https://www.mobily.com.sa/wps/portal/web/careers |
| elm | Elm / technology | https://elm.sa/en/recruitment/Pages/join-our-family.aspx |
| snb | Saudi National Bank / banking | https://www.alahli.com/en/pages/about-us/careers/snb-cooperative-training-program |
| saudia | Saudia / aviation | https://careers.saudia.com/?locale=en_GB |
| jarir | Jarir / retail | https://www.jarir.com/job-opportunities |
| pwc | PwC / consulting | https://www.pwc.com/m1/en/careers/student-jobs.html |
| alrajhi | Al Rajhi Bank / banking | https://careers.alrajhibank.com.sa/en/page/coop-program/ |

The registry is inserted idempotently on the first manual run. Existing `active`
settings are preserved. Runtime network permissions come from reviewed code, not
request parameters or mutable MongoDB metadata. Additional ATS scopes must be
proven by a link from the company's official site and scoped to its tenant/path.
Do not allow an entire shared ATS domain for all companies.

## Pipeline and evidence

1. Acquire a unique MongoDB run lease; return HTTP 202 immediately.
2. Read active, reviewed sources serially. Respect robots.txt, HTTPS and TLS.
3. Parse JobPosting JSON-LD or reviewed detail templates; follow at most four
   training-related pages. Never treat a general careers/talent page as a vacancy.
4. Require a training/program title AND student/practical-training evidence in
   the advert. Reject senior/manager/trainer roles, generic talent pools, explicit
   foreign-country postings, unrelated hiring organizations and unapproved URLs.
5. Extract responsibilities/requirements only from their own structured fields
   or labeled sections. Missing fields remain empty/null. No sibling fallback.
6. Verify the application URL; 404/410 = false, inaccessible/blocked = unknown.
   An actual apply control plus reachable URL can indicate open; a closure or
   elapsed deadline always wins. HTTP 200 alone does not prove open.
7. Use a unique canonical Darbak company match for its existing logo first.
   Otherwise accept only a supplied official logo in reviewed URL scope, or blank.
8. Extract only useful public recruitment emails from the official advert;
   keep them in Candidate, never the suggestions directory.
9. Pass facts through existing sanitization/schema and candidate classification.
   Duplicate/proposed-update decisions are made by the existing service only.
10. Save per-source timings/errors/warnings and aggregate counters. Nothing is
    published or applied to an existing Opportunity.

Greenhouse and Lever adapters use their documented public GET APIs:
https://docs.greenhouse.io/job-board.html and https://github.com/lever/postings-api.
They are fixture-tested extension strategies, not unverified Saudi pilot tenants.
SuccessFactors supports public HTML job descriptions and structured data.
Workday, Oracle and SmartRecruiters currently use the structured-HTML fallback.
SPA-only tenants return `ATS_TENANT_FEED_OR_RENDERING_ADAPTER_REQUIRED`; a complete
tenant-specific SPA/feed adapter is **not** claimed in v1. No private API guessing,
CAPTCHA bypass or headless browser crawling is implemented.

## Freshness and confidence

- Reject postings older than 180 days, future posted dates, and prior-year titles
  or explicit cohort labels unless there is a recent (<=30-day) posted date.
- A future closing date alone does not renew an old posting.
- Only unambiguous ISO source dates/ATS timestamps are parsed. Ambiguous human
  dates are retained in raw text for review, not guessed.
- Undated otherwise-valid adverts may enter review; `dateVerified=null` prevents
  them being marked ready by existing publication validation.
- Weights: official +30, working URL +20, verified company +15, open +15,
  deadline +5, duties +5, requirements +5, posted within 30 days +5.
- Deductions: closed -50, broken URL -40, company mismatch -40; cap 0..100.
  Identity mismatches are rejected before ingestion regardless of score.
- Confidence never triggers publication.

## Running locally

Use a **development MongoDB** when testing writes. Configure the existing
`MONGO_URI` and `ADMIN_PASSWORD`; no new production environment variables.

```sh
cd backend
npm install
npm start
```

Start the frontend with `REACT_APP_API_URL=http://localhost:3001 npm start`.
Open `/darbak-owner-review-2026`, select **Opportunity Inbox**, enter the existing
admin password, expand **الاكتشاف من المصادر الرسمية**, and click
**Run Discovery Now**. The panel shows the latest run and each source's outcome.
Polling is every five seconds only while this panel is open and a run is active;
it stops on completion, error or unmount. Closing the panel does not cancel a run.

Admin API (same `x-admin-password` authorization):

- `POST /api/admin/opportunity-candidates/discovery/run`: start, no URL/body needed.
- `GET /api/admin/opportunity-candidates/discovery`: latest summary and source health.
- Concurrent run: 409. Runs less than one minute apart: 429.

No-write network checks (do not load .env or connect to MongoDB):

```sh
cd backend
npm run discovery:check
npm run discovery:dry-run
node scripts/discoverOpportunities.js --source=stc
```

## Bounds, persistence and limitations

Eight requests/source including robots/redirects/application verification, four
pages, five training candidates/source; defaults adjustable in reviewed config.
Eight-second HTTP/DNS deadlines, two-MB response cap, 600ms minimum request spacing,
robots crawl-delay respected up to ten seconds, public IP validation pinned to
the TLS connection, approved scope checked at every redirect. Source budget 60s,
run budget eight minutes. No fetching unknown domains from page links.

Run lease is 15 minutes. A process restart may interrupt a run; the next admin
status read/start marks expired leases interrupted, preserving completed source
logs. No automatic restart/cron. Run logs expire after 30 days. Source health is
retained. Indexes: source `key` unique, run `lock` partial unique, run `createdAt` TTL.
Detailed source errors are admin-only; raw HTML is not printed to server logs.

## Validation on 2026-09-29

- Unit tests: extraction, field separation, ordinary roles, closed/broken adverts,
  useful emails, URL cleanup, freshness, company/country mismatch, robots, SSRF,
  per-job application links, adapter fixtures, pipeline duplicate accounting.
- Isolated MongoDB integration: real createOpportunityCandidate duplicate and
  update classification; no Opportunity writes; seed idempotence; admin auth;
  run locking, throttling and interrupted-run recovery.
- Frontend: explicit action/auth, completion summary, disabled concurrent action,
  errors, no polling while collapsed; existing Inbox tests preserved.
- Backend suite and frontend build passed; existing Browserslist/development
  middleware warnings remain.
- Initial live read-only run: 10 checked, 0 eligible candidates, 7 source failures.
- Subsequent URL check: STC, Aramco, Saudia and Jarir HTTP 200. SABIC/PwC robots
  unavailable; Mobily/Al Rajhi timed out; Elm/SNB failed TLS certificate-chain
  validation. TLS/robots protections were not disabled. No real discoveries are
  claimed from fixture tests; the pilot is not yet a full-coverage production feed.
- Local admin end-to-end run against isolated test MongoDB: the button started
  and completed a real bounded network run, 10 sources checked, 6 errors, zero
  eligible opportunities/candidates. Four readable sources returned no structured
  training postings; program information pages were not converted into jobs.
- Mobile DOM check at 390px: document scroll width 390px, Inbox width 358px.
  Production deployment was not performed for this phase.

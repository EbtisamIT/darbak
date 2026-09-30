# Opportunity Discovery v1.5

Implemented locally on 2026-09-30. This phase is not deployed. No auto-publish,
cron, AI calls, login scraping, TLS exceptions, CAPTCHA bypass, or changes to
published Opportunities. Existing v1 documentation describes the prior version;
this document supersedes its adapter, registry and pipeline sections.

## Architecture

1. URL discovery (`stages.discoverUrls`): reviewed source links, structured-data
   URLs, public ATS listing endpoints, and an optional search provider. Search
   snippets are discarded. A careers fetch failure does not discard search URLs.
2. URL trust (`acceptUrls`): clean tracking parameters, deduplicate URLs, require
   exact approved host AND path scope. Shared ATS providers require tenant paths;
   a shared hostname alone never establishes company identity.
3. Extraction (`extractOpportunity`): each strategy provides `discoverJobs`,
   `extractJob`, `verifyJob`. Missing fields remain missing. General program
   information is not a JobPosting. Browser rendering is optional for successful
   HTTP responses that expose a dynamic shell, not for blocked/failed HTTP.
4. Verification (`verifyExtracted`): existing training/audience, identity,
   location, freshness, application URL and confidence rules. Closed postings are
   reported, not sent into the Inbox. Undated valid ads remain review candidates.
5. Candidate creation: only `createOpportunityCandidate()`. Existing duplicate
   and proposed-update classification remains authoritative. No Opportunity writes.
6. Emails without eligible postings: independent `OpportunityEmailLead` records,
   never Candidates or production application suggestions.

Counters and bounded per-source/per-URL details are persisted on the run. Detailed
failure codes include ROBOTS_DENIED, TLS_ERROR, TIMEOUT, DYNAMIC_PAGE,
NO_JOB_CONTENT, NOT_TRAINING, OLD_OPPORTUNITY, CLOSED, FETCH_FAILED, PARSER_FAILED,
and POLICY_DENIED. Original network error codes are retained in fetch details.
ROBOTS_DENIED also means robots could not be safely loaded; it does not always
mean an explicit Disallow rule.

## Source management

Registry fields now include officialDomains, careerDomains, atsProvider,
atsIdentifiers, searchQueries, reviewStatus and approvalEvidence. Existing ten
reviewed sources remain compatible. Imported sources are inactive/pending;
import never overwrites existing keys or approves network scopes automatically.
An administrator must review official ownership and official ATS linkage before
explicit activation. Approval is a human attestation, not inferred from a logo.

Admin panel: Opportunity Inbox -> official discovery -> sources/email section.
Export JSON, edit a source entry, import the array, review displayed domains and
evidence links, approve. Up to 100 entries/import, 1,000 registered entries read,
20 sources/run, oldest checked first so growing registries rotate fairly.
No hundreds of manually hardcoded companies are required. JSON only, not CSV.

Export shape (all fields accepted on import): key, name, company, sourceUrl,
sourceType, country=SA, trustScore, officialDomains[], careerDomains[],
atsProvider, atsIdentifiers { tenant?, apiUrl? }, searchQueries[], aliases[],
scopes[], approvalEvidence[]. Evidence must be on a declared official domain.
Selectors/code/credentials cannot be imported. The existing vetted code registry
retains control of its own network scopes; imports cannot overwrite it.

`OpportunityEmailLead`: company, companyNormalized, email, emailType, optional
city/majors, sourceUrl, officialSource, confidence, discoveredAt, status
(new/existing/approved/rejected), timestamps. Unique index companyNormalized+email;
status+discoveredAt index. Existing public application-channel checks are reused.
This phase exposes a read-only lead list, not a production approval/publication flow.

## Admin endpoints

All paths below are under `/api/admin/opportunity-candidates/discovery` and reuse
existing `x-admin-password` authorization. No public API is added.

- GET `/`: latest run, source registry, search/browser configuration flags.
- POST `/run`: manual asynchronous run, existing lease and throttle retained.
- POST `/test-url`: `{ sourceKey, url, sendToInbox: false }`. Preview only.
  `true` explicitly re-fetches/re-verifies and ingests eligible results; client
  preview data is never trusted. A separate 120-second lease serializes URL tests.
- GET `/sources/export`: JSON array, without run history or secrets.
- POST `/sources/import`: `{ sources: [...] }`, pending/inactive insert-only.
- POST `/sources/:key/approve`: `{ reviewedOfficialOwnership: true }`.
- GET `/leads?page=1`: latest 20 independent email leads, admin only.

Preview includes extracted facts (even when verification rejects them), verified
Candidate data when eligible, confidence, missingFields, verification, source,
fetchMethod, counters and failure details. Changing the selected URL invalidates
the preview. No lead or candidate is saved during preview.

## Provider support and configuration

- Greenhouse: public board list + detail GET endpoints; prospect posts excluded.
- Lever: public postings list + individual posting GET endpoint.
- SmartRecruiters: public company postings list + detail GET endpoint. No API
  key is sent; endpoints requiring credentials fail visibly rather than accessing
  internal postings. Configure a verified tenant and scoped API URL.
- SuccessFactors: JobPosting data or its public job-description templates,
  including closed/filled job shells. No OData credential guessing.
- Workday/Oracle: public structured HTML + optional browser rendering. No full
  tenant-specific CXS/Oracle REST connector is claimed. Sites needing POST APIs,
  authentication, unreviewed assets or tenant-specific templates need a separate
  reviewed adapter and possibly provider access.

Official API references used:
- https://docs.greenhouse.io/job-board.html
- https://github.com/lever/postings-api
- https://developers.smartrecruiters.com/docs/endpoints
- https://playwright.dev/docs/api/class-browsercontext

Search has no vendor dependency or fake fallback. Optional server environment:
`DISCOVERY_SEARCH_PROVIDER_MODULE=/absolute/path/to/reviewed-provider.cjs`.
That module exports `search(query, { signal, limit })`, returning `[{ url }]`.
It owns provider credentials through environment variables; never place them in
registry JSON. Provider calls are abortable, timeout after eight seconds, and are
bounded to three queries/source by default. Search result URLs still pass the
official scoped trust guard. No configured provider means zero queries and an
explicit SEARCH_PROVIDER_NOT_CONFIGURED warning, not a successful empty search.
Queries include company-specific Arabic/English terms, site-scoped terms, and
the Saudi/student general query catalogue. Configure searchQueries order to
choose the bounded subset; the entire catalogue is not sent on every run.

Optional browser environment: `DISCOVERY_BROWSER_EXECUTABLE` points to an installed
Chromium executable. Dependency: playwright-core 1.58.2; no browser download is
performed by install/build. Browser contexts are temporary, unauthenticated,
sandboxed, service workers and WebSockets blocked. HTTP resources are fulfilled
only by the same public-IP-pinned, HTTPS, robots-aware reader. No arbitrary browser
networking, POST, cookies or bypass flags. Unapproved required JS assets fail
closed. Dynamic pages needing them require reviewed source scopes. A successful
HTTP shell is required; TLS/robots/timeouts never trigger fallback. Browser
launch/navigation and lifetime have bounds. Deployments without sandbox support
must leave this feature disabled, not add `--no-sandbox`.

## Limits and metrics

Eight-minute run, 60-second source budget, two-MB responses, eight-second network
timeouts, bounded pages/candidates. Imported sources default to 20 HTTP requests,
eight pages, five candidates; old sources retain their stricter limits. The hard
request ceiling is 40. At most 100 distinct input URLs and 200 detail entries are
retained/source. ATS listings are bounded samples, not exhaustive global crawls.
EmailsLeads counts newly saved leads; existing lead records are not counted again.
CandidatesCreated/newCandidates excludes duplicate and update_existing statuses,
which have separate counters. Pages fetched includes successful API documents;
robots requests are in network request counts, not page counts. The UI polls only
while an expanded panel has an active run.

## Known URL tests and real run

Local isolated MongoDB was used, never MONGO_URI/production.

Known official live URL:
https://careers.pwc.com/job/Amman-Consulting%2C-Digital-%26-Cyber-Internship-Programme-Amman-2026-Amma/1440545633/

The search index displayed the former advert, but direct public HTML says the
position has been filled. The test correctly returns `CLOSED`, fetchMethod=http,
one fetched page, no Candidate. Confirmed in CLI and the local admin UI. This is
NOT evidence of a live open Saudi internship.

Known fixture tests: eligible marketing/COOP -> structured fields and verification;
normal job -> NOT_TRAINING; old advert -> OLD_OPPORTUNITY; closed -> CLOSED;
unofficial domain -> POLICY_DENIED. Greenhouse, Lever and SmartRecruiters API
fixtures test separate listing/detail extraction. Real Chromium (fixture transport
only) successfully rendered a dynamic posting and refused a denied JS resource.
No live browser or search-provider coverage is claimed from those tests.

Run Discovery Now, actual network, 2026-09-30 (also verified from local UI):

| Metric | Result |
| --- | ---: |
| Sources checked | 10 |
| Search queries run | 0 (provider not configured) |
| URLs discovered before extraction | 8 |
| Official URLs accepted / rejected | 8 / 0 |
| Pages fetched / fetch failures | 8 / 6 |
| Training postings / extracted opportunities | 0 / 0 |
| New candidates / duplicates / updates | 0 / 0 / 0 |
| Email leads / closed opportunities | 0 / 0 |
| Errors | 6 |

Per-source outcomes:
- STC: two URLs, two fetched, both NO_JOB_CONTENT (program/category pages).
- Aramco: four URLs, four fetched, all NO_JOB_CONTENT (program information).
- Saudia: one URL, NO_JOB_CONTENT.
- Jarir: one URL, NO_JOB_CONTENT.
- SABIC/PwC main pages: ROBOTS_DENIED (robots unavailable).
- Mobily/Al Rajhi: TIMEOUT.
- Elm/SNB: TLS_ERROR (certificate chain).

No URL was silently promoted from a search result or general careers page.
All ten sources need an external search provider to exercise search-based discovery;
direct extraction remains available without it. These results prove the diagnostic
pipeline, not full live opportunity coverage. Production deployment: NOT RUN.

## Files changed in v1.5

- backend/models/OpportunitySource.js, OpportunityDiscoveryRun.js,
  OpportunityEmailLead.js (new).
- backend/services/opportunityDiscovery/: stages.js, strategies.js, failures.js,
  search.js, registry.js, management.js, browser.js (new); adapters.js, pipeline.js,
  service.js, sources.js, extract.js, verification.js, http.js (updated).
- backend/services/opportunityCandidateRoutes.js.
- backend/scripts/discoverOpportunities.js; backend/package.json/package-lock.json.
- backend/tests/opportunityDiscoveryHybrid.test.js,
  opportunityDiscoveryBrowser.integration.js (new); opportunityDiscovery.test.js,
  opportunityDiscovery.integration.js (updated).
- src/components/opportunityInbox/DiscoveryTools.jsx and its test (new),
  DiscoveryPanel.jsx, OpportunityInbox.css (updated).
- This report. Existing unrelated dirty changes were preserved.

## Local commands

```sh
cd backend
node scripts/discoverOpportunities.js --source=pwc --url='https://careers.pwc.com/job/Amman-Consulting%2C-Digital-%26-Cyber-Internship-Programme-Amman-2026-Amma/1440545633/'
npm run discovery:dry-run
# Optional reviewed JSON array for a no-write CLI test:
node scripts/discoverOpportunities.js --registry=/absolute/path/sources.json --source=company-key --url=https://official.example/careers/job/42
```

CLI never loads .env or connects MongoDB. The JSON example URL above illustrates
syntax only and is not a real source/advert. In the admin UI use Test Opportunity
URL for preview, then the separate explicit Inbox action if eligible.

Checks: backend suite, isolated MongoDB integration, 11 frontend tests, Chromium
fixture integration, frontend build and 23 company prerenders passed. Existing
Browserslist data-age warning remains. `npm audit` reports one moderate transitive
`qs` issue (not auto-upgraded in this scoped task). System Node20 also warns about
an existing nested OpenAI dependency requiring Node22; integration used Node23.

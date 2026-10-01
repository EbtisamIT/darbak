# Opportunity enrichment and manual automation

## Scope

The backend now supports Search → classified official URL → existing fetch/ATS
strategy → actual posting detection → deterministic enrichment → verification →
`createOpportunityCandidate()`. No AI, cron, external-agent dependency, automatic
publication, or writes to `Opportunity` are introduced. Existing Search Only,
Full Discovery, Email Leads, import bridge and Inbox publication remain available.

Admin: Opportunity Inbox → official discovery → **Run Opportunity Automation**.
This calls the existing protected `POST /api/admin/opportunity-candidates/discovery/run`
with `{"mode":"automation"}`. The existing run lease, request budgets, run report
and status endpoint are reused. Full Discovery and Test Opportunity URL also use
enrichment now. `runOpportunityAutomation()` is the backend job entry point;
normal Admin runs supply the existing registry, company logos and ingestion hook.

## Facts, evidence and normalization

- ATS API and JSON-LD precede supported official HTML selectors. Browser fallback
  remains restricted to dynamic pages permitted by the existing reader. Robots,
  TLS, approved tenant/path scope, public-IP validation and redirect guards remain.
- Search titles/snippets are discovery hints and audit metadata, never candidate
  facts. Company mismatch, non-training, non-Saudi, talent-pool and stale adverts
  stay excluded. Mentioning Saudi Arabia in company boilerplate is insufficient.
- Responsibilities/requirements are read from recognized sections or explicit
  structured fields. Missing sections remain `[]`. New heading variants include
  Your role, Role responsibilities, What you'll do, Who you are, Candidate
  requirements, مهام المتدرب and الفئة المستهدفة. No title-based task generation.
- Cities and majors use `src/data/trainingVocabulary.json`, extracted without
  changing any values from Darbak's existing lists. The frontend consumes that
  same file. Alias maps translate recognized English terms only. Short IS/IT/CS
  abbreviations require uppercase, avoiding normal English pronouns.
- `rawCities`, `rawMajors`, `majorScope` retain source context. All majors does
  not expand to a list. Broad business-related eligibility stays broad. Unknown
  explicit cities remain verbatim; unmatched majors remain in `rawMajors`.
- Explicit labelled dates and structured date fields are kept separate. No
  article-date→deadline fallback, relative-date guessing or ambiguous date parsing.
- Card descriptions are short excerpts of actual advert text (max 450 chars),
  not generated claims. Raw extracted text is retained separately.
- Existing Darbak company logo wins. Otherwise only an explicitly supplied logo
  on the approved official company domain survives. No secondary-board logo.
- Existing URL sanitizer and email extractor are reused. Email categories include
  internship as well as coop/training/careers/recruitment/hr/application/general.
- `extractionEvidence` is stored per field with source URL, method, optional
  section heading and raw evidence. It is selected only on the detail API, not
  sent with every list card. The UI exposes it under an expandable details area.

## Completeness and review states

Completeness is not confidence: company/title/application URL/cities/majors each
10; responsibilities/requirements each 15; deadline/logo/description/type each 5.
An explicit all/broad major scope counts as supplied eligibility, not missing.
Missing fields additionally flag posted date, training start and duration without
penalizing the 100-point score a second time.

`reviewStatus` is an additive field, preserving legacy Inbox `status` values:

| Review status | Meaning |
| --- | --- |
| READY_FOR_REVIEW | Official source, verified company, actual posting, available page and working application URL; application is OPEN or UNKNOWN_BUT_ACTIONABLE |
| NEEDS_DETAILS | Verified open advert, insufficient facts |
| NEEDS_VERIFICATION | Actual Saudi training advert but open state/link verification incomplete |
| UPDATE_EXISTING | Existing duplicate matcher found an update |
| DUPLICATE | Existing duplicate matcher found the same opportunity |
| CLOSED | Explicit closure or expired deadline; legacy status expired |

`pageAvailability` is independent of `applicationState`. An enabled Apply button
on a fresh official posting is actionable even when JavaScript prevents proving
the final form is open. Such rows retain `verification.appearsOpen = null`, use
`UNKNOWN_BUT_ACTIONABLE` and show "حالة نموذج التقديم لم تُتحقق آليًا". Completeness
remains a separate indicator, not a blocker for these verified actionable rows.
Disabled/missing CTAs, unavailable pages and unclear identities remain unverified.
Explicit closure in visible HTML overrides stale JobPosting JSON-LD. Direct
posting 404/410 means GONE/CLOSED, not a JavaScript failure.

Ready **for review** never publishes automatically. The new badges and filter use reviewStatus; legacy published
and rejected states remain visible. Manual/agent candidates without enrichment
metadata retain their prior classification behavior.

## Retry

`POST /api/admin/opportunity-candidates/:id/retry-enrichment` uses the same Admin
authorization. It requires exactly one active approved source for the current
source URL. It re-fetches and updates the same candidate, never creates a second
one, and refuses published/rejected/demo candidates. A short cross-worker lease
limits simultaneous retry work. Failures leave the original record untouched.

New Admin edits track changed fields in `manualFields`. Retry retains those facts
and labels their evidence `admin_review`; verification is re-evaluated, not carried
forward blindly. Mongoose optimistic concurrency prevents a slow extraction from
overwriting an intervening edit. Edits made before field tracking was introduced
cannot be reliably identified retroactively; review a legacy candidate before
using retry if it has important older manual edits.

## Secondary recovery

Training hints from classified trusted job boards and robots-blocked official ATS
postings are eligible. Blocked postings remain NEEDS_VERIFICATION Discovery Leads,
not completed candidates. Only an independently approved official mirror may be
recovered; a different SmartRecruiters transport cannot bypass denied robots.
A uniquely
recognized registry company is required; ambiguous identities stay as leads.
At most five recovery queries are reserved from the configured per-run search
budget, using company/title and site-qualified queries. Results must pass the
same official tenant/path classifier before extraction. No secondary page is
fetched or treated as authoritative. Unresolved hints remain Discovery Leads.

Run reporting includes discovered URLs, extracted pages, enriched opportunities,
weighted average completeness, review buckets, duplicates/updates/closed, email
leads, recovery queries and resolved official URLs, plus stage-level reasons.

## Validation and current live-source limitations

Tests:

```sh
node backend/tests/opportunityEnrichment.test.js
INBOX_TEST_RUNTIME=/private/tmp/darbak-inbox-test-runtime node backend/tests/opportunityEnrichment.integration.js
node backend/scripts/testOpportunityEnrichment.js /private/tmp/darbak-enrichment-live.json
```

The integration test creates and deletes a temporary MongoDB replica set. It does
not read .env or production Mongo credentials. It covers metadata persistence,
review states, duplicate/update compatibility, same-row retry, manual-edit and
concurrent-edit protection, failures leaving data unchanged, and no publication.

Live smoke on 2026-10-01 used the unchanged network guards, without DB writes:

| Source | Result | Extracted candidate |
| --- | --- | --- |
| STC COOP page | NO_JOB_CONTENT | None; page not recognized as a discrete advert |
| Aramco internship information page | NO_JOB_CONTENT | None; no supported discrete advert extracted |
| SNB cooperative training | TLS_ERROR / UNABLE_TO_VERIFY_LEAF_SIGNATURE | None |
| Al Rajhi cooperative training | TIMEOUT | None |
| Bosch Business Management Intern, SmartRecruiters | ROBOTS_DENIED | None |
| Bosch Software Development Intern, SmartRecruiters | ROBOTS_DENIED | None |

Bosch is a test-only tenant, not a source inserted into the production registry.
Its recruiting provider is disclosed at https://jobs.bosch.com/en/ . No denied
request was retried through a different transport to evade policy. These runs
produced no extracted responsibilities, requirements, completeness or evidence;
those values are unavailable, not fabricated zero-quality opportunities.

Separate deterministic fixture evidence is available by setting
`ENRICHMENT_TEST_REPORT` when running the unit test. The rich fixture contains two
actual listed tasks, two qualifications, Riyadh/Jeddah, Computer Science/Information
Systems, separate posted/deadline/start dates and six-month duration. With the
fixture logo it scores 100 and READY_FOR_REVIEW; an application timeout changes
the state to NEEDS_VERIFICATION; explicit closure gives CLOSED. These are
**test fixtures**, not claims of current opportunities in those companies.

Teamtailor is supported through shared HTML/JSON-LD extraction and enabled Apply
CTA detection. Tier 1 sources (Teamtailor, Greenhouse, Lever, company-owned pages)
precede Tier 2 dynamic ATS; rotation happens within each tier.

Live revalidation on 2026-10-02: Chalhoub Marketing Internship is
READY_FOR_REVIEW / UNKNOWN_BUT_ACTIONABLE. People Experience is CLOSED: visible
HTML explicitly says the position is no longer active, despite stale JSON-LD.
No production deployment or scheduling has been performed.

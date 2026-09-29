# Opportunity Inbox

The inbox is an admin-only review layer, not a second public opportunity system.
Open the existing admin page and choose **Opportunity Inbox — صندوق الفرص**.

## Changed Files

Existing files: `backend/server.js`, `backend/models/Opportunity.js`,
`backend/package.json`, `src/pages/AdminReviewPage.jsx`.

New files:

- `backend/models/OpportunityCandidate.js`
- `backend/services/opportunityCandidateData.js`
- `backend/services/opportunityCandidates.js`
- `backend/services/opportunityCandidateRoutes.js`
- `backend/services/opportunityCandidateSeed.js`
- `backend/tests/opportunityCandidates.test.js`
- `backend/tests/opportunityCandidates.integration.js`
- `src/components/opportunityInbox/OpportunityInbox.jsx`
- `src/components/opportunityInbox/OpportunityInbox.css`
- `src/components/opportunityInbox/OpportunityInbox.test.jsx`
- `src/components/opportunityInbox/CandidateCard.jsx`
- `src/components/opportunityInbox/CandidateEditor.jsx`
- `src/components/opportunityInbox/CandidateComparison.jsx`
- `src/components/opportunityInbox/candidateLabels.js`
- `backend/OPPORTUNITY_INBOX.md`

## Endpoints

All routes require the existing `x-admin-password` authorization:

- `GET /api/admin/opportunity-candidates` (20 per page, filters and global summary)
- `POST /api/admin/opportunity-candidates` (validated intake; used by manual entry)
- `GET /api/admin/opportunity-candidates/:id` (preview, raw content, existing record and diff)
- `PATCH /api/admin/opportunity-candidates/:id` (edit and reclassify)
- `POST /api/admin/opportunity-candidates/:id/publish`
- `POST /api/admin/opportunity-candidates/:id/reject`
- `POST /api/admin/opportunity-candidates/:id/mark-duplicate`
- `POST /api/admin/opportunity-candidates/:id/apply-update`

Apply-update accepts `fields` from the server-generated diff and
`expectedUpdatedAt` from the current opportunity. It never changes unselected
fields; `city` and `cities` stay synchronized. Existing Darbak application
programs must instead be edited in program management. Rejected/published
candidates are not editable. Published requests are idempotent.

## Development Fixtures

Use a **separate development MongoDB replica set**, not the production URI:

```sh
NODE_ENV=development ENABLE_OPPORTUNITY_INBOX_SEED=true npm start
```

In the admin Inbox, choose **إضافة 5 حالات تجريبية**. Alternatively send an
authenticated `POST /api/admin/opportunity-candidates/seed`. This endpoint is
disabled unless both environment settings match. It creates five candidates
only: ready, incomplete, duplicate, proposed update and discovered email.
The comparison fixture is a snapshot inside a demo candidate, NOT a public
Opportunity. All fixtures are labelled `isDemo`; publishing and applying
updates from them are prohibited. Re-running the seed returns existing demo
rows. Demo rows participate only in the internal Inbox summary.

## Publication / Storage

Publication uses the current `sanitizeOpportunityPayload`, moderation check,
and `Opportunity` model. Description, supplied responsibilities, requirements
and training start are formatted into the existing public `note` field. Majors
map to `specialties`; the first city maps to `city`, all cities to `cities`.
Unknown details are never generated. Provenance, raw content and discovered
emails stay in the candidate. Emails are not copied to public suggestions.
Existing-email detection checks opportunity application URLs/notes and company
contact emails, never student accounts. Confidence is supplied by the discovery
source or reviewer (0–100); no AI or hidden confidence inference is used.

An optional unique `automationKey` on Opportunity protects inbox publications
against identical concurrent publications. Existing records have no key and
are unaffected. MongoDB **transactions require a replica set or Atlas**.
Candidate completion and public writes commit together. Index creation must
be enabled for new indexes as in the existing Mongoose deployment.

## Matching and Future Discovery

`createOpportunityCandidate(input)` in `services/opportunityCandidates.js` is
the future Discovery Agent boundary. It validates typed facts, strips tracking
URLs and classifies BEFORE storage. No scraping, AI requests, URL fetching or
scheduler runs here. Verification booleans are unknown by default and must all
be confirmed by the reviewer/discovery provider before publication. Missing
deadline/responsibilities are allowed, not inferred.

Matching requires exact normalized company identity or one unambiguous
existing company alias identity. Generic shared words do not join companies.
Title token Jaccard similarity must be at least 0.8. Conflicting program types
or cities prevent matching. A shared cleaned URL is needed, or an exact title
with matching city and deadline. Changed deadlines require a shared job-specific
URL identifier, not a generic careers page. Added facts yield update_existing;
otherwise duplicate. Equally strong multiple matches require review. Existing
inbox entries are checked as well. Publication repeats the check.

Legacy opportunities lack normalized company/URL indexes, so ingestion streams
a limited projection of existing opportunities (not a truncated subset).
This is O(N) per admin intake, not per public request. Future high-volume
discovery should batch this index in memory or add a backward-compatible
normalized index. List data is paginated, raw content is excluded, and no
polling is used. Summary dates currently use UTC, explicitly labelled in UI.

## Checks

`npm test` in backend includes inbox tests. The tests use isolated in-memory
persistence doubles for publication/rollback; they do not claim to validate
production MongoDB transactions. Frontend tests:

```sh
CI=true npm test -- --watchAll=false --runInBand src/components/opportunityInbox/OpportunityInbox.test.jsx
```

An optional real HTTP/replica-set suite is also supplied:

```sh
INBOX_TEST_RUNTIME=/path/to/temporary/runtime node tests/opportunityCandidates.integration.js
```

That runtime needs `mongodb-memory-server@10`. The suite creates its own
temporary MongoDB replica set and never reads `.env`/`MONGO_URI`. It checks the
actual sanitizer, indexes, publication rollback, idempotency, update conflicts,
filters, authorization and seed isolation. `--serve` keeps an isolated five-row
demo API on port 3111 for UI review. This is NOT the production backend.
No production data is seeded by this change.

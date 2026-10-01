# Opportunity Discovery v1.6

Implemented locally on 2026-09-30. Not deployed. No cron or automatic publication.

## Live execution status

`npm run discovery:search` was attempted with `--load-brave-env`.
It returned `SEARCH_PROVIDER_NOT_CONFIGURED`, exit code 1, before any request.
`BRAVE_SEARCH_API_KEY` was absent from the process and backend/.env.

- Actual queries sent: 0.
- Actual search results received: 0 (search did not execute).
- Actual unique URLs / official URLs / recent training hints: not measured.
- Twenty useful live URLs: unavailable without a successful authenticated search.
- Full live Discovery: deliberately not run before Search Only succeeds/review.

This is a configuration blocker, NOT evidence that Brave found zero opportunities.
No web-tool search or test fixtures were substituted for real Brave results.

## Configuration

Set these on the backend only (see `.env.discovery.example`):

```
BRAVE_SEARCH_API_KEY=<server secret>
DISCOVERY_MAX_SEARCH_QUERIES_PER_RUN=25
DISCOVERY_RESULTS_PER_QUERY=10
DISCOVERY_SEARCH_CONCURRENCY=3
```

Restart the backend after environment changes. No frontend secret/config is needed.
The existing DISCOVERY_SEARCH_PROVIDER_MODULE override still has priority when set.
Otherwise the built-in Brave adapter activates when the key is present.
Hard caps: 50 queries/run, 20 results/query, 5 concurrent requests. These protect
cost and the bounded Mongo run report. A 429/auth failure stops queued requests;
already in-flight requests can finish. No automatic retries or paid escalation.
Lower concurrency if the account plan has a lower rate limit.

## Pipeline and review boundary

1. Run Search Discovery Only: central Saudi Arabic/English query pack + approved
   company domain queries. A shared run budget, not a separate budget per company.
   About 40% general queries; remaining queries round-robin through sources.
   Persisted searchRotation changes company order and query terms next run.
2. Brave Web Search returns title/url/snippet/date when supplied. `freshness=pm`
   selects the provider's last-month page freshness; this is NOT a verified job
   publication date. `country=ALL`; Saudi targeting is explicit in query text.
   API key is in X-Subscription-Token to the fixed HTTPS Brave endpoint only.
   Redirects are rejected, TLS verification remains on, requests time out.
3. Normalize URLs: existing sanitizer, remove fragment, sort query parameters.
   Keep job identifiers. Merge identical URLs and retain discoveredByQueries.
4. Classify using approved exact host AND path scopes. Shared ATS domains alone
   do not prove the tenant. Ambiguous/revoked scopes never authorize fetching.
5. Search Only stores the report and future-review OpportunityDiscoveryLead rows
   for training-looking nonofficial results. No job-page fetch, extraction,
   EmailLead generation, Candidate creation, or Opportunity write occurs.
6. After reviewing the report, Run Full Discovery uses its server-side run ID.
   Requires a completed/partial Search Only run less than 24 hours old with
   accepted results. Does not search again or spend a second query budget.
7. Revalidate scopes, select recent-hint accepted URLs first, then use existing
   adapters/robots-aware reader. Twenty source groups/run, existing per-source
   page/candidate limits. Budget-excluded and revoked URLs remain in details.
8. Verification requires real posting + training audience + Saudi evidence +
   visible functioning application + not closed/old. Missing dates remain null;
   an undated otherwise open ad can be an admin-review candidate. Never infer
   Saudi location merely from Source.country or from a search snippet.
9. Only createOpportunityCandidate writes Candidates, retaining existing Darbak
   duplicate/update classification. Search metadata is separate from facts.
   Existing Opportunity records are neither edited nor published by Discovery.

Classes: official_company, official_ats, university, trusted_job_board, social,
unknown. Only the first two with a training hint may proceed. Universities/job
boards/social/unknown are review-only. Social URLs are not fetched even if a
mistaken registry entry includes them. New official companies still require
registry approval; a search result cannot authorize its own domain.

## Storage and metadata

- OpportunityCandidate.searchDiscovery is optional: provider, resultTitle,
  resultDescription, resultPublishedAt, firstDiscoveredAt, discoveredByQueries,
  classification. Existing publication mapping does not send it to students.
- OpportunityDiscoveryRun: search-only/full types, searchRotation, searchReport,
  searchRunId. Existing unique run lease and 30-day TTL retained.
- OpportunityDiscoveryLead: unique normalized URL, title/snippet, domain,
  classification/reason, provider, discoveredByQueries, optional provider date,
  discoveredAt, lastDiscoveredAt, status. Index(status, discoveredAt).
  Repeat discovery preserves the first discovery and review status. It never
  becomes a Candidate or public application suggestion automatically.
- OpportunityEmailLead remains separate for actual official-page emails.

Search snippets are bounded review metadata only. They are not used for job
responsibilities, requirements, company identity, locations or job dates.

## Admin and CLI

Existing admin authorization, base `/api/admin/opportunity-candidates/discovery`:

- POST `/run` `{ "mode": "search-only" }`.
- POST `/run` `{ "mode": "full", "searchRunId": "..." }`.
- GET `/` reports latest run, last search, sources and configuration flags.
- GET `/search-leads?page=1` returns future-review leads, admin-only.
- Existing known URL, source import/export, email leads routes retained.

Admin: Opportunity Inbox -> official discovery. Search Only and Full are separate
explicit actions. Full is disabled without suitable Search Only results. Reports
show query outcomes, per-URL trust/rejection reason, original search queries,
stage details and 20-row pagination. Candidate details show Brave metadata.

Read-only CLI (does not connect MongoDB or load MONGO_URI):

```sh
cd backend
npm run discovery:search -- --output=/private/tmp/darbak-brave-search.json
node scripts/discoverOpportunities.js --full-from=/private/tmp/darbak-brave-search.json
```

The second command is explicitly verification-only with `candidateWrites: 0`;
real Candidate creation/duplicate checks happen through the protected Admin Full
action. The first command reads only Brave key/budget variables from backend/.env.
`--rotation=N` allows testing the CLI's next query pack without persistent state.

## Files

New:
- services/opportunityDiscovery/searchProviders/braveSearchProvider.js
- services/opportunityDiscovery/queryPack.js, searchDiscovery.js, searchWorkflow.js
- models/OpportunityDiscoveryLead.js
- tests/opportunityDiscoverySearch.test.js
- .env.discovery.example and this report
- ../src/components/opportunityInbox/SearchDiscoveryReport.jsx and its test

Updated:
- models/OpportunityCandidate.js, OpportunityDiscoveryRun.js
- services/opportunityCandidateData.js, opportunityCandidateRoutes.js
- services/opportunityDiscovery/search.js, stages.js, pipeline.js, service.js,
  verification.js, failures.js
- scripts/discoverOpportunities.js, package.json
- tests/opportunityDiscovery.test.js, opportunityDiscoveryHybrid.test.js,
  opportunityDiscovery.integration.js
- ../src/components/opportunityInbox/DiscoveryPanel.jsx and its test,
  CandidateCard.jsx, OpportunityInbox.css

## Validation

- Provider fixtures: parsing, headers, missing key, authentication/rate failures,
  URL sanitation, budget/rotation/concurrency and canonical URL dedup.
- Search-only: zero page requests/candidate writes, nontraining exclusion,
  all trust classes, shared-tenant protection, query provenance, lead isolation.
- Full: structured original facts only, real candidate service in isolated Mongo,
  duplicate/update classification, no Opportunity mutations, revoked scopes,
  closed/old/nontraining/unknown-Saudi rejection.
- Backend suite, isolated integration and frontend tests executed locally.
- Production build completed, including 23 company prerenders.
- UI tested at 390px and 1280px with no horizontal overflow; missing-key message
  verified and Full button disabled. Preview is isolated demo data, not live leads.
- Existing Browserslist age and webpack dev-server deprecation warnings remain.

Official provider references:
- https://api-dashboard.search.brave.com/api-reference/web/search/get
- https://github.com/brave/brave-search-skills/blob/main/skills/web-search/SKILL.md

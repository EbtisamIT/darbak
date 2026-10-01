# COOP Sweep import bridge

## Contract and security

`POST /api/internal/opportunity-discovery/import` is a backend-to-agent endpoint,
not a frontend API. Set `DARBAK_DISCOVERY_IMPORT_TOKEN` in the backend environment
and the Sweep runner's secret store. Generate it with `openssl rand -hex 32`;
never commit the value, add it to a `REACT_APP_*` variable, or log request headers.
Tokens shorter than 32 characters fail closed with HTTP 503. Incorrect/missing
Bearer authorization returns 401.

The existing server's 1 MB JSON limit applies. Each batch accepts at most 25
opportunities and 25 email leads. Split larger sweeps into numbered chunks with
stable run IDs, for example `sweep-2026-10-01-chunk-001`. No cron or automatic
publishing is configured by this bridge.

```json
{
  "source": "darbak_coop_sweep",
  "runId": "sweep-2026-10-01-chunk-001",
  "opportunities": [
    {
      "company": "Example Company",
      "title": "COOP Software Intern",
      "programType": "coop",
      "cities": ["Riyadh"],
      "majors": [],
      "responsibilities": [],
      "requirements": [],
      "applicationUrl": "https://example.com/jobs/123?jobId=123",
      "sourceUrl": "https://example.com/jobs/123",
      "sourceType": "company",
      "verificationNotes": "External agent observations; needs Darbak review"
    }
  ],
  "emailLeads": [
    {
      "company": "Example Company",
      "email": "coop@example.com",
      "emailType": "coop",
      "sourceUrl": "https://example.com/contact"
    }
  ]
}
```

The example is a fixture, not a verified real opportunity. Optional factual
fields also include `remote`, `description`, `postedAt`, `deadline`,
`trainingStartDate`, `duration` (string), `companyLogo`, `rawContent`, and
`discoveredEmails: [{email, type, sourceUrl, confidence}]`. Dates use ISO 8601 or
YYYY-MM-DD. Missing dates stay null; missing arrays stay empty. Non-array cities,
majors, responsibilities or requirements are rejected rather than guessed.

## Agent usage

Keep the body as JSON in `sweep-batch.json`. Set `DARBAK_API_URL` to the backend
(locally `http://127.0.0.1:3001`), not the React website. First preview:

```sh
curl --fail-with-body --request POST \
  "$DARBAK_API_URL/api/internal/opportunity-discovery/import?dryRun=true" \
  --header "Authorization: Bearer $DARBAK_DISCOVERY_IMPORT_TOKEN" \
  --header "Content-Type: application/json" \
  --data-binary @sweep-batch.json
```

After reviewing the preview, use the identical request without `?dryRun=true`.
Production automation should read secrets directly from its environment and
redact authorization in HTTP tracing. Never use shell tracing (`set -x`) with
these commands.

The Sweep should retain the exact batch body and run ID until it has a response.
Retry timeouts/5xx with bounded backoff using that same ID/body. A completed retry
returns the original receipt with `replayed: true`, not additional candidates.
409 `IMPORT_RUN_PAYLOAD_CONFLICT` means that ID already belongs to different
content; a deliberately changed batch needs a new run ID. 409
`IMPORT_CONFLICT_RETRY` is retryable with the same body. The receipt is retained
without a TTL. Do not start forwarding real sweeps until the backend is deployed
and its token configured.

## Processing and summaries

1. Authenticate, validate the envelope, validate each item independently.
2. Allowlist facts using the existing candidate schema and URL sanitizer.
   Existing list normalization trims/deduplicates city and major labels without
   inferring a different city or major. Existing company normalization and
   approved-alias duplicate matching run inside `createOpportunityCandidate()`.
3. Ignore caller-supplied status, verification, confidenceScore, search metadata
   and import audit fields. Add server-owned agent provenance. Verification
   remains unknown and confidenceScore zero until reviewed; even a complete new
   item is `needs_review`, not automatically `ready`.
4. Reuse existing duplicate/update classification and candidate creation.
5. Reuse `saveEmailLead()` for standalone emails, with officialSource=false and
   confidence=0. Existing leads/approved decisions are not overwritten.
6. Commit candidates, leads and receipt in one MongoDB transaction. MongoDB must
   support replica-set transactions, as required by existing Inbox publication.
   Any storage failure rolls back the whole valid portion of the batch.

`created` counts all inserted candidate records, INCLUDING those tagged duplicate
or update_existing. `duplicates`, `updates`, `needsReview` are subsets, not extra
records. `received` counts opportunity input items. `rejected` counts invalid
items across both arrays, with `errors[].kind/index/fields` locating them.
`emailLeads` has independent received/created/existing counts. Valid expired
candidates preserve the existing `expired` status, visible in `results`.
Invalid items do not prevent valid items from being imported; their rejection is
also retained in the receipt. Correcting them requires a new run ID.

Dry run uses the same creation service in non-persisting mode and simulates
intra-batch duplicates. It does not reserve run IDs, create receipts/candidates/
leads, fetch URLs, publish, or update Opportunities. Its counts are forecasts;
concurrent changes between preview and import may change classification.

Agent notes/email confidence are observations, not verification. The bridge
does not fetch untrusted URLs and cannot establish that an agent's claimed
company domain is official. The existing Admin verification and publish checks
still apply. The UI marks new imports `Agent`, search results `Brave`, internal
discovery `Official Discovery`, and direct admin creation `Manual`. Legacy
records without provenance remain explicitly unspecified, not relabeled as
verified discovery.

## Local regression test

The test launches its own temporary MongoDB replica set and local Express server;
it never loads `.env` or connects to production. Supply the directory containing
the development-only `mongodb-memory-server` dependency:

```sh
cd backend
INBOX_TEST_RUNTIME=/private/tmp/darbak-inbox-test-runtime npm run test:opportunity-import
```

It submits four candidate fixtures (new, duplicate, proposed update, incomplete)
plus one email lead and reads them back through the actual Admin Inbox endpoint.
Additional checks cover auth, spoofed verification, URL cleaning, missing facts,
dry-run no-writes, invalid arrays, mixed valid/invalid batches, simultaneous
retries, changed-payload conflicts, email-only batches, injected database failure
rollback/retry, and unchanged Opportunity records. Fixtures are removed when the
temporary database stops; they are not left in the production Inbox.

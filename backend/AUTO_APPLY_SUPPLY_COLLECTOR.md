# Auto Apply supply collector

The runner collects evidence into `AutoApplySupply` through the Phase 1 ingestion service. It does not publish to the Opportunity Inbox, match students, submit applications, or call a classifier. No in-process timer starts the runner.

## Sources and evidence

- The watchlist comes from Darbak's existing approved source registry, including STC, Saudi Aramco, SABIC, Mobily, Elm, SNB, Saudia, Jarir, PwC, and Al Rajhi. Admin-approved registry additions are available on later runs. Source pages and ATS APIs use the existing scoped reader and respect robots, redirects, and request budgets. Unapproved search URLs are never fetched.
- The search provider is the existing Darbak provider (Brave when configured). Arabic and English queries rotate. A search snippet with a specified employer, explicit Saudi training context, and a candidate email or identifiable application URL may be saved as a lead. Snippets never overwrite stronger existing evidence.
- New findings default to `NEEDS_REVIEW`. A known legacy email may enter as `VERIFIED` only through the Phase 1 adapter. The collector keeps the page title, text, email and link context, query when available, and explicit dates. It does not infer location, intended majors, fields or required documents. Remote postings require evidence they accept applicants in Saudi Arabia.
- Rechecks update `lastCheckedAt` without advancing `lastSeenAt` when the source cannot be read or the channel cannot be found again. Only an explicit deadline or expiry automatically expires a record. An observed replacement with new dates can reactivate it for review. The date-only closing day remains open until the end of the Riyadh day.

## Safe CLI

`npm --prefix backend run supply:collect` previews without opening a Mongo connection or writing audit/supply records. It may read configured public sites. Add `-- --load-brave-env` to read only `BRAVE_SEARCH_API_KEY` from the backend dotenv file for preview. Set `AUTO_APPLY_SUPPLY_PREVIEW_ENV_FILE` to use a different local file. The write path requires explicit `-- --write`, the collector enable flag, and an explicitly configured `MONGO_URI` in the process environment.

## Scheduler preparation

When ready to enable this in a deployment, provision the schema indexes first if auto-indexing is disabled. The partial unique lock index on `AutoApplySupplyRun` and the unique dedupe index on `AutoApplySupply` are required. Keep startup scheduling disabled and configure a single Cloud Scheduler HTTP job:

- Cron `0 0,6,12,18 * * *`, timezone `Asia/Riyadh`. Cadence is controlled by the scheduler. Allow sufficient request time for the 150-second run budget and cleanup.
- Target `POST https://api.darbak.space/api/internal/auto-apply-supply/run` after deployment. Set `Authorization: Bearer …` using a dedicated high-entropy server secret shared with `AUTO_APPLY_SUPPLY_COLLECTOR_TOKEN` (at least 32 characters). Keep it out of source control and logs. Requests cannot supply URLs, limits, or credentials through the body.
- The same runner is available to existing Darbak admins via `POST /api/admin/auto-apply-supply/run`. For the latest internal counters and sanitized error codes, use `GET /api/admin/auto-apply-supply/summary`. Overlap returns `409`. Interrupted locks expire and can be recovered by a later invocation. Finished-run reports expire after 30 days.

| Server setting | Default |
| --- | --- |
| `AUTO_APPLY_SUPPLY_COLLECTOR_ENABLED` | off |
| `AUTO_APPLY_SUPPLY_MAX_QUERIES_PER_RUN` | 8, maximum 24 |
| `AUTO_APPLY_SUPPLY_MAX_PAGES_PER_RUN` | 16, maximum 40 logical page reads |
| `AUTO_APPLY_SUPPLY_MAX_NEW_CANDIDATES_PER_RUN` | 25, maximum 100 inserts |
| `AUTO_APPLY_SUPPLY_MAX_RECHECKS_PER_RUN` | 5, maximum 20 records |
| `AUTO_APPLY_SUPPLY_SEARCH_FRESHNESS` | `pw`, accepts `pd` and `pm` |
| `AUTO_APPLY_SUPPLY_SEARCH_QUERIES` | built-in query pack, optional newline-separated override |
| `AUTO_APPLY_SUPPLY_WATCHLIST` | all active approved entries, optional comma-separated source keys |

The preview reports how many distinct observations need review, with writes always zero. A write-run report includes query, result, page, candidate, update, duplicate, expiration and error counters. Application/Pilot switches are independent of the collector flag.

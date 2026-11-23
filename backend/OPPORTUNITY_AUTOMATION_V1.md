# Opportunity Automation v1

Scheduling and automatic publication are handled by the **Opportunity
Autopilot** (see the section at the end). It is off until an admin enables it.

`MAX_DAILY_RUNS` (or `DISCOVERY_MAX_DAILY_RUNS`) defaults to 2 and cannot
exceed 2. `DISCOVERY_MAX_SEARCH_QUERIES_PER_RUN` (or
`MAX_SEARCH_QUERIES_PER_RUN`) defaults to 20 and cannot exceed 20.
All manual search/full/automation admissions count toward the daily quota;
failed attempts that acquired a run also consume their slot. Existing run
records count too. Known-URL tests and enrichment retries have separate
existing leases and are not full automation runs.

Riyadh calendar days determine the quota. Daily slot uniqueness and global
lease uniqueness are Mongo indexes acquired atomically by one run insert.
Concurrent starts return `SKIP_ALREADY_RUNNING`; exhausted quota returns
`MAX_DAILY_RUNS`. The active worker renews its lease every 30 seconds and
checks ownership before creating a candidate. Interrupted runs retain their
daily quota. History is retained by the existing 30-day TTL; the Admin endpoint
returns only the latest 10 run summaries, with timestamps, duration and counters.

Content filtering is deterministic and runs during enrichment. It removes
company history, branding and generic culture prose from tasks and card
descriptions, preserves source eligibility requirements and actual role tasks,
and uses the actual job title as a conservative fallback when no role overview
exists. Removed generic task text raises `contentQualityWarning`; raw source
text and filtering evidence remain available for review. No AI or snippet facts.

Existing candidates are not rewritten in bulk. Retry enrichment on the same
candidate can apply improved extraction while preserving manual edits.
The production run must be reviewed before any future scheduling activation.

## Opportunity Autopilot

Admin: Opportunity Inbox → **الأتمتة الكاملة للفرص**. Enabled on first boot
(set `OPPORTUNITY_AUTOPILOT_ENABLED=false` before deploying to start it off);
after that the admin switch stored in MongoDB (`opportunityautopilotstate`)
decides. Code:
`services/opportunityDiscovery/autopilot.js`.

Each tick (every 10 minutes in-process, or the external cron endpoint):

1. **Discovery** — starts one `automation` run per slot (08:00, 20:00
   Riyadh). Still bound by `MAX_DAILY_RUNS` and the search budget above.
2. **Auto-publish** — candidates from `official_discovery` only:
   - published when the title explicitly says co-op/تدريب تعاوني, the page is
     official/available/actionable (`readyForReview`), no content-quality
     warning, completeness ≥ `OPPORTUNITY_AUTOPILOT_MIN_COMPLETENESS` (70),
     deadline not passed, and no duplicate match;
   - internships, summer and graduate programs are rejected;
   - matches of existing opportunities only apply an extended deadline;
   - everything else stays in the inbox (`autopilot.decision = review`).
3. **Daily re-check** (from 06:00 Riyadh, once per day, up to
   `OPPORTUNITY_AUTOPILOT_RECHECK_LIMIT` = 40, oldest-checked first) — active
   opportunities whose source/application URL is inside an approved source.
   Two consecutive closed/removed results set `status: expired`; blocked or
   failed fetches never close. Extended deadlines are applied. URLs outside
   approved sources are counted as `unverifiable`; deadline expiry still
   applies to them via `markExpiredOpportunities`.

Every automatic action is logged (last 100) and auto-closed opportunities can
be reopened from the panel; reopened ones are excluded from future checks.

Configuration:

- `BRAVE_SEARCH_API_KEY` — required for discovery.
- `OPPORTUNITY_AUTOPILOT_CRON_SECRET` (falls back to `TELEGRAM_CRON_SECRET`).
- `OPPORTUNITY_AUTOPILOT_DISABLED=true` — emergency kill switch.
- Publication uses MongoDB transactions (Atlas / replica set).

Hosts that sleep (e.g. Render free) do not run the in-process timer.
`.github/workflows/keep-api-awake.yml` pings the public `/api/health` every
10 minutes so the timer keeps running; no secret is involved. GitHub pauses
scheduled workflows after 60 days without repository activity; re-enable it
from the Actions tab if that happens. Alternatively, call the tick endpoint
from an external cron:

```sh
curl -X POST https://<api-host>/api/internal/opportunity-autopilot/tick \
  -H "x-opportunity-autopilot-secret: $OPPORTUNITY_AUTOPILOT_CRON_SECRET"
```

The tick is idempotent (slots, daily re-check day and a 20-minute lease are
stored in MongoDB), so the timer and the cron can both run safely.

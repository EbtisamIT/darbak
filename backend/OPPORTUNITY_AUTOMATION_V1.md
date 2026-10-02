# Opportunity Automation v1

Scheduling is configuration only: **disabled**, 08:00 and 20:00 Asia/Riyadh.
No scheduler, cron registration, or automatic publication is installed.

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

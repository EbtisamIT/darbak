# Auto Apply supply classification

The existing collector calls the classifier after ingestion, inside the same run lease. It only selects active `NEEDS_REVIEW` records with captured evidence. The collector preview never calls OpenAI. No new worker, queue or schedule is started.

## Config

- `AUTO_APPLY_SUPPLY_AI_ENABLED=true` opts in on an enabled collector. Default is off.
- Reuse `OPENAI_API_KEY`. Model selection uses `OPENAI_SUPPLY_CLASSIFIER_MODEL`, then the existing `OPENAI_RESUME_LIGHT_MODEL`, then Darbak's established light-model default. Input is bounded discovery evidence and channel metadata. Student profiles and documents are not sent. Structured Responses use `store: false`, with no SDK retries.
- `AUTO_APPLY_SUPPLY_MAX_AI_CLASSIFICATIONS_PER_RUN` defaults to 20 and accepts 0–50. Zero disables calls. Calls also respect the collector's remaining time. Failures preserve the current verification state and trigger a 24-hour retry cooldown for that specific input. Authentication, model and rate-limit errors end the AI portion early.

## Decisions and review

The model returns strict structured output with verbatim references to source fields. The policy admits extracted metadata only when the associated quote exists and explicitly supports the value. Dates are accepted when supported by unambiguous evidence. Existing observations and dedupe keys stay intact.

A verified result requires relevant training, Saudi coverage, a valid channel, direct application evidence, and an approved source type. A named inbox is not proof. Email verification requires training-application instructions that cite the exact destination. Search snippets do not qualify as verification evidence. A passed explicit closing date takes precedence, and remote opportunities require evidence of Saudi applicant eligibility.

The record retains the version, requested/actual model, timestamp, evidence hash, deterministic reason, model's recommended status and cited excerpts. Superseded assessments are archived with the previous observation. Concurrency checks discard results for outdated evidence. Existing verified legacy channels are excluded from AI classification. For one record's trace, use the existing admin authorization with `GET /api/admin/auto-apply-supply/:id/classification`; the collector feature flag gates this endpoint. No model reasoning is requested or stored.

The collector's internal summary stores provider call counts, successful and failed classifications, observed unchanged skips, cooldown/stale skips, status counts and reported input/output token usage. Content changes clear the previous classification for a fresh decision. Unchanged outcomes do not consume another call.

## Local smoke

With the existing OpenAI environment configured, `node backend/scripts/checkAutoApplySupplyClassifier.js` makes up to three calls on synthetic Arabic and English fixtures. It reports statuses and usage, does not fetch company sites and does not read or write MongoDB.

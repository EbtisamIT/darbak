const Supply = require("../models/AutoApplySupply");
const Run = require("../models/AutoApplySupplyRun");
const EmailChannel = require("../models/AutoApplyEmailChannel");
const Opportunity = require("../models/Opportunity");
const { ingestSupply, recordSupplyRecheck, supplyDedupeKey } = require("./autoApplySupply");
const { classifySupplyBatch, classifierSettings, classificationHash, emptyAiMetrics } = require("./autoApplySupplyClassifier");
const { legacyEmailObservation } = require("./legacyAutoApplySupply");
const { settings, discoveryPlan } = require("./autoApplySupplyCollectorConfig");
const { extractPage, extractSearchLead, channelForUrl, secureUrl, programType, geography } = require("./autoApplySupplyExtraction");
const { SOURCES } = require("./opportunityDiscovery/sources");
const { registrySources } = require("./opportunityDiscovery/management");
const { createReader, allowedUrl } = require("./opportunityDiscovery/http");
const { htmlLinks, strategyFor } = require("./opportunityDiscovery/strategies");
const { searchOpportunityUrls, configuredSearchProvider } = require("./opportunityDiscovery/search");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");
const { publicSearchUrl, relevantSearchResult, searchPriority, dynamicSource } = require("./autoApplySupplyDynamicSearch");

const RUN_LOCK = "auto-apply-supply";
const RUN_BUDGET_MS = 150000;
const LEASE_MS = 600000;

function mongoRuns(model = Run) {
  return {
    async acquire(trigger, now, canarySlot) {
      await model.init();
      await model.updateOne({ lock: RUN_LOCK, leaseUntil: { $lte: now } }, {
        $unset: { lock: "", leaseUntil: "" }, $set: { status: "interrupted", finishedAt: now },
      });
      try {
        return await model.create({ trigger, status: "running", lock: RUN_LOCK, startedAt: now,
          ...(canarySlot ? { canarySlot } : { purgeAt: new Date(+now + 30 * 86400000) }),
          leaseUntil: new Date(now.getTime() + LEASE_MS) });
      } catch (error) {
        if (error.code !== 11000) throw error;
        return null;
      }
    },
    async finish(run, status, metrics, now) {
      await model.updateOne({ _id: run._id, lock: RUN_LOCK }, {
        $unset: { lock: "", leaseUntil: "" }, $set: { status, metrics, finishedAt: now },
      });
    },
    async current(run, now) {
      return Boolean(await model.exists({ _id: run._id, lock: RUN_LOCK, leaseUntil: { $gt: now } }));
    },
    latest: () => model.findOne({ trigger: { $in: ["scheduler", "admin", "cli"] } })
      .sort({ startedAt: -1 }).select("trigger status startedAt finishedAt metrics").lean(),
    canaries: () => model.find({ trigger: "canary", canarySlot: { $in: [1, 2, 3] } })
      .sort({ canarySlot: 1 }).select("canarySlot status startedAt finishedAt metrics").limit(3).lean(),
  };
}

async function existingSupply(limit, now, sourceKeys) {
  const expired = await Supply.find({ isActive: true, collectorSource: { $in: [...sourceKeys, "darbak", "legacy-email"] }, $or: [
    { expiresAt: { $lte: now } }, { deadline: { $lte: now } }, { "classification.effectiveDeadline": { $lte: now } },
  ] }).limit(limit).lean();
  if (expired.length === limit) return expired;
  const due = await Supply.find({ isActive: true, collectorSource: { $in: sourceKeys }, sourceUrl: { $ne: "" },
    _id: { $nin: expired.map((item) => item._id) } }).sort({ lastCheckedAt: 1, _id: 1 }).limit(limit - expired.length).lean();
  return [...expired, ...due];
}

async function existingDarbak(now, limit, sources) {
  if (!limit) return [];
  const daySlot = Math.floor(now.getTime() / (6 * 3600000));
  const channels = await EmailChannel.find({ verificationStatus: "verified", acceptsTrainingApplications: true })
    .sort({ _id: 1 }).skip((daySlot % 4) * limit).limit(limit).lean();
  const linked = await Opportunity.find({ _id: { $in: channels.map((entry) => entry.activeOpportunityId).filter(Boolean) } })
    .select("title deadline").lean();
  const byId = new Map(linked.map((entry) => [String(entry._id), entry]));
  const adapted = channels.map((channel) => ({ ...legacyEmailObservation(channel, byId.get(String(channel.activeOpportunityId))),
    collectorSource: "legacy-email" }));
  const published = await Opportunity.find({ status: "active", sourceType: "admin",
    $or: [{ isDarbakApplication: true }, { "automationCheck.autoPublished": true }] })
    .sort({ createdAt: -1 }).limit(limit).select("organizationName companyId title city cities trainingMode applicationMethod applicationUrl logoUrl deadline sourceUrl note isDarbakApplication createdAt").lean();
  for (const item of published) {
    const sourceUrl = secureUrl(item.sourceUrl);
    const isDarbak = item.isDarbakApplication && item.applicationMethod === "darbak";
    if (!isDarbak && !sourceUrl) continue;
    const applicationUrl = isDarbak ? "https://darbak.space/where-to-train/opportunity/" + item._id : secureUrl(item.applicationUrl);
    if (!applicationUrl) continue;
    const evidence = [item.title, item.note].filter(Boolean).join("\n");
    const type = programType(item.title, evidence);
    if (!type || (item.trainingMode === "remote" && (!sourceUrl || !geography({ remote: true }, evidence, sourceUrl)))) continue;
    if (!isDarbak && !sources.some((source) => allowedUrl(sourceUrl, source))) continue;
    adapted.push({ companyName: item.organizationName, companyId: item.companyId, opportunityTitle: item.title,
      opportunityId: isDarbak ? String(item._id) : undefined, channelType: isDarbak ? "DARBAK_APPLICATION" : channelForUrl(applicationUrl),
      applicationUrl, sourceUrl: sourceUrl || applicationUrl, sourceType: "darbak_reviewed_opportunity",
      collectorSource: "darbak", evidenceText: evidence.slice(0, 4000), trainingType: type,
      companyLogo: secureUrl(item.logoUrl), deadline: item.deadline, remote: item.trainingMode === "remote" ? true : null });
  }
  return adapted;
}

function declaredCompany(result, sources) {
  const snippet = " " + normalizeCompanyComparable([result.title, result.description].join(" ")) + " ";
  const matches = sources.filter((source) => [source.company, ...(source.metadata.aliases || [])].some((alias) => {
    const name = normalizeCompanyComparable(alias);
    return name.length >= 3 && snippet.includes(" " + name + " ");
  }));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return null;
  // A literal employer named in the result title is useful as an unverified lead.
  // There is no page fetch or employer-domain approval on this path.
  const title = String(result.title || "");
  const direct = title.match(/(?:\bat\s+|لدى\s+)([\p{L}\p{N}][\p{L}\p{N} &.'’-]{2,100})(?=\s*(?:[|–—,]|$))/iu)?.[1]?.trim();
  const separated = title.match(/(?:\||\s[–—-]\s)\s*([\p{L}\p{N}][\p{L}\p{N} &.'’-]{2,100})$/u)?.[1]?.trim();
  const suffix = separated && !/^(?:jobs?|careers?|apply(?: now)?|Saudi Arabia|KSA|Riyadh|Jeddah|وظائف|السعودية|الرياض|جدة)$/i.test(separated) &&
    !/linkedin|indeed|glassdoor|bayt|jobzaty|wuzzuf|توظيف|وظائف/i.test(separated) ? separated : "";
  const name = direct || suffix;
  return name ? { key: "search-unscoped", company: name } : null;
}

function safeError(stage, error, metrics) {
  const code = error?.code || error?.message;
  const allowed = /^(?:SEARCH_(?:AUTH_FAILED|RATE_LIMITED|TIMEOUT|HTTP_\d{3})|HTTP_\d{3}|ROBOTS_[A-Z_]+|SOURCE_[A-Z_]+|UNAPPROVED_URL_SCOPE|REQUEST_TIMEOUT|DNS_TIMEOUT|NON_PUBLIC_ADDRESS|RESPONSE_TOO_LARGE|REDIRECT_LIMIT|PAGE_BUDGET_EXHAUSTED|RUN_BUDGET_EXHAUSTED|RUN_LEASE_LOST)$/;
  metrics.errors += 1;
  if (metrics.errorCodes.length < 20) metrics.errorCodes.push({ stage, code: allowed.test(code) ? code : "COLLECTOR_STEP_FAILED" });
}

async function runAutoApplySupplyDiscovery({
  trigger = "cli", env = process.env, preview = false, clock = () => new Date(),
  runs = mongoRuns(), registry = preview ? async () => SOURCES : () => registrySources({ activeOnly: true }),
  readSource = createReader, searchProvider, ingest = ingestSupply, listRechecks = existingSupply,
  recheck = recordSupplyRecheck, listDarbak = existingDarbak, classifyBatch = classifySupplyBatch, canarySlot, retryCandidateIds = [],
} = {}) {
  const startedAt = clock();
  const config = settings(env);
  const aiSettings = classifierSettings(env);
  const isCanary = trigger === "canary";
  const dynamic = (isCanary && canarySlot === 3) || env.AUTO_APPLY_SUPPLY_DYNAMIC_DISCOVERY === "true";
  const end = +startedAt + RUN_BUDGET_MS;
  const discoveryEnd = isCanary ? +startedAt + 90000 : end;
  if (isCanary && ![1, 2, 3].includes(canarySlot)) throw new Error("CANARY_SLOT_REQUIRED");
  const run = preview ? null : await runs.acquire(trigger, startedAt, canarySlot);
  if (!preview && !run) return { status: "already_running" };
  const metrics = { queries: 0, resultsFound: 0, pages: 0, uniqueCandidates: 0, created: 0, updated: 0,
    duplicates: 0, needsReview: 0, errors: 0, expired: 0, reactivated: 0, limited: 0, errorCodes: [],
    ai: emptyAiMetrics(), pagesFetched: 0, fetchFailures: 0, rawCandidates: 0,
    stages: { scopedSearchResults: 0, unscopedSearchResults: 0, unscopedLeadChannels: 0,
      relevanceQualified: 0, knownDomainResults: 0, dynamicDomainResults: 0, urlSafetyRejected: 0,
      trainingPages: 0, snippetOnlyLeads: 0, geographyUnknown: 0,
      processedPages: 0, noProgram: 0, noSaudiEvidence: 0, employerMismatch: 0,
      outOfScopePosting: 0, relevantPrograms: 0, noChannel: 0, pageChannels: 0, ingestionFailures: 0 },
    ...(isCanary ? { candidateIds: [], ...(canarySlot === 3 ? { retryCandidateIds } : {}) } : {}) };
  const seen = new Set(), readers = new Map(), pages = new Map();
  let status = "completed", discoveredNew = 0;
  function timeRemaining() { return clock().getTime() < end; }
  function discoveryTimeRemaining() { return +clock() < discoveryEnd; }
  async function canWrite() {
    if (!timeRemaining()) throw new Error("RUN_BUDGET_EXHAUSTED");
    if (run && !await runs.current(run, clock())) throw new Error("RUN_LEASE_LOST");
  }
  async function save(candidate, { weak = false } = {}) {
    metrics.rawCandidates += 1;
    const key = supplyDedupeKey(candidate);
    if (seen.has(key)) { metrics.duplicates += 1; return; }
    seen.add(key);
    metrics.uniqueCandidates += 1;
    if (preview) {
      metrics.needsReview += Number(candidate.verificationStatus !== "VERIFIED");
      return;
    }
    await canWrite();
    const result = await ingest(candidate, { now: clock(), preserveExisting: weak, createIfMissing: discoveredNew < config.maxNew });
    if (result.action === "limited") { metrics.limited += 1; return; }
    if (result.isNew || result.action === "created") discoveredNew += 1;
    if (isCanary && (result.isNew || result.action === "created")) metrics.candidateIds.push(String(result.record._id));
    if (result.isNew || result.action === "created") metrics.created += 1;
    else if (result.action === "duplicate") metrics.duplicates += 1;
    else metrics.updated += 1;
    if (result.action === "expired") metrics.expired += 1;
    if (result.action === "reactivated") metrics.reactivated += 1;
    if (result.action !== "duplicate" && result.record.verificationStatus === "NEEDS_REVIEW") metrics.needsReview += 1;
    if (aiSettings.enabled && result.action === "duplicate" && result.record.classificationHash === classificationHash(result.record, aiSettings.model)) {
      metrics.ai.skippedUnchanged += 1;
    }
  }

  async function saveAll(candidates, options) {
    for (const candidate of candidates) {
      if (!timeRemaining()) break;
      try { await save(candidate, options); }
      catch (error) {
        if (["RUN_BUDGET_EXHAUSTED", "RUN_LEASE_LOST"].includes(error.message)) throw error;
        metrics.stages.ingestionFailures += 1;
        safeError("ingestion", error, metrics);
      }
    }
  }

  function readerFor(source) {
    if (!readers.has(source.key)) {
      const base = readSource(source, { deadline: discoveryEnd });
      readers.set(source.key, { async read(raw) {
        if (!discoveryTimeRemaining()) throw new Error("RUN_BUDGET_EXHAUSTED");
        const url = secureUrl(raw);
        if (!url || !allowedUrl(url, source)) throw new Error("UNAPPROVED_URL_SCOPE");
        const key = source.key + " " + url;
        if (!pages.has(key)) {
          if (metrics.pages >= config.maxPages) throw new Error("PAGE_BUDGET_EXHAUSTED");
          metrics.pages += 1;
          pages.set(key, Promise.resolve().then(() => base.read(url)).then((result) => {
            metrics.pagesFetched += 1;
            return result;
          }, (error) => {
            metrics.fetchFailures += 1;
            if (["NON_PUBLIC_ADDRESS", "UNAPPROVED_URL_SCOPE", "ROBOTS_REDIRECT_UNAPPROVED"].includes(error.code)) {
              metrics.stages.urlSafetyRejected += 1;
            }
            throw error;
          }));
        }
        return pages.get(key);
      } });
    }
    return readers.get(source.key);
  }

  const fetched = new Set();
  const withChannels = new Set();
  async function inspect(source, reference, query) {
    const key = source.key + " " + reference.url;
    if (fetched.has(key)) return [];
    fetched.add(key);
    const reader = readerFor(source);
    const strategy = strategyFor(source);
    const result = await strategy.extractJob(reference, source, reader);
    if (!result.page) return [];
    metrics.stages.processedPages += 1;
    const beforePrograms = metrics.stages.relevantPrograms;
    const candidates = extractPage(result.page, source, { jobs: result.jobs, query, diagnostics: metrics.stages, allowUnknown: dynamic });
    if (metrics.stages.relevantPrograms > beforePrograms) metrics.stages.trainingPages += 1;
    metrics.stages.pageChannels += candidates.length;
    if (candidates.length) {
      withChannels.add(publicSearchUrl(reference.url));
      withChannels.add(publicSearchUrl(result.page.url));
    }
    await saveAll(candidates.map((candidate) => ({ ...candidate, lastCheckedAt: clock() })));
    return /json/i.test(result.page.headers?.["content-type"] || "") ? [] :
      htmlLinks(result.page.text, result.page.url).filter((entry) => allowedUrl(entry.url, source)).slice(0, 3);
  }

  try {
    const { sources, queries } = discoveryPlan(config, await registry(), startedAt);
    if (!preview && !isCanary && config.maxRechecks) {
      const rows = await listRechecks(config.maxRechecks, startedAt, sources.map((source) => source.key));
      for (const row of rows) {
        if (!discoveryTimeRemaining()) break;
        const source = sources.find((item) => item.key === row.collectorSource);
        const validPage = source && allowedUrl(row.sourceUrl, source) && metrics.pages < config.maxPages;
        const expired = [row.deadline, row.expiresAt, row.classification?.effectiveDeadline].some((date) => date && date <= startedAt);
        if (!validPage && !expired) continue;
        if (validPage) {
          try { await inspect(source, { url: row.sourceUrl }, row.searchQuery); }
          catch (error) { safeError("recheck", error, metrics); }
        }
        await canWrite();
        const result = await recheck(row, { now: clock() });
        if (result.action === "expired") { metrics.expired += 1; metrics.updated += 1; }
      }
    }

    let provider = searchProvider;
    if (provider === undefined) provider = configuredSearchProvider();
    const searchResults = [];
    if (provider && config.maxPages) {
      for (const query of queries) {
        if (!discoveryTimeRemaining()) break;
        metrics.queries += 1;
        try {
          const { results } = await searchOpportunityUrls(query, { provider, limit: 8, freshness: config.freshness });
          metrics.resultsFound += results.length;
          searchResults.push(...results.map((result) => ({ ...result, query })));
        } catch (error) {
          safeError("search", error, metrics);
          if (["SEARCH_AUTH_FAILED", "SEARCH_RATE_LIMITED"].includes(error.code)) break;
        }
      }
    }

    const results = [], leads = [], dynamicPages = [], snippetResults = [];
    for (let result of searchResults) {
      if (dynamic) {
        const url = publicSearchUrl(result.url);
        if (!url) { metrics.stages.urlSafetyRejected += 1; continue; }
        if (!relevantSearchResult(result)) continue;
        metrics.stages.relevanceQualified += 1;
        result = { ...result, url };
      }
      const source = sources.find((item) => allowedUrl(result.url, item));
      if (source) {
        metrics.stages.scopedSearchResults += 1;
        if (dynamic) metrics.stages.knownDomainResults += 1;
        results.push({ source, reference: { url: result.url }, query: result.query });
      }
      else {
        metrics.stages.unscopedSearchResults += 1;
        const employer = declaredCompany(result, sources);
        if (dynamic) {
          metrics.stages.dynamicDomainResults += 1;
          const priority = searchPriority(result);
          if (priority) dynamicPages.push({ source: dynamicSource(result.url, employer),
            reference: { url: result.url }, query: result.query, priority });
          if (employer) snippetResults.push({ result, employer });
        } else if (employer) leads.push(...extractSearchLead(result, employer));
      }
    }
    metrics.stages.unscopedLeadChannels = leads.length;
    const queryByPage = new Map(results.map((item) => [item.source.key + " " + item.reference.url, item.query]));
    const seeds = sources.map((source) => ({ source, reference: { url: source.sourceUrl }, seed: true,
      query: queryByPage.get(source.key + " " + source.sourceUrl) }));
    // Reserve part of the budget for new search results instead of only re-visiting the seed list.
    const seedFirst = results.length ? Math.ceil(seeds.length / 2) : seeds.length;
    const distinctResults = [...new Map(results.map((item) => [item.source.key + " " + item.reference.url, item])).values()];
    const dynamicQueue = [...new Map(dynamicPages.sort((a, b) => b.priority - a.priority)
      .map((item) => [item.reference.url, item])).values()].slice(0, 12);
    const queue = dynamic && dynamicQueue.length
      ? [...distinctResults.slice(0, 4), ...dynamicQueue.slice(0, 8), ...seeds.slice(0, 5), ...dynamicQueue.slice(8), ...seeds.slice(5)]
      : [...seeds.slice(0, seedFirst), ...distinctResults.slice(0, Math.ceil(config.maxPages / 2)), ...seeds.slice(seedFirst)];
    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      if (!discoveryTimeRemaining() || metrics.pages >= config.maxPages) break;
      try {
        if (item.seed && item.source.atsIdentifiers?.apiUrl) {
          const strategy = strategyFor(item.source);
          const list = await strategy.discoverJobs(item.source, readerFor(item.source));
          queue.splice(index + 1, 0, ...list.urls.slice(0, 2).map((reference) => ({ source: item.source, reference })));
        } else {
          const links = await inspect(item.source, item.reference, item.query);
          if (item.seed && links.length) queue.splice(index + 1, 0, { source: item.source, reference: links[0] });
        }
      } catch (error) { safeError("page", error, metrics); }
    }

    if (!preview && !isCanary && timeRemaining()) {
      try { await saveAll(await listDarbak(startedAt, Math.min(config.maxNew, 10), sources), { weak: true }); }
      catch (error) {
        if (["RUN_BUDGET_EXHAUSTED", "RUN_LEASE_LOST"].includes(error.message)) throw error;
        safeError("darbak", error, metrics);
      }
    }
    for (const { result, employer } of snippetResults) {
      if (!withChannels.has(result.url)) leads.push(...extractSearchLead(result, employer, { allowUnknown: true }));
    }
    if (dynamic) metrics.stages.snippetOnlyLeads = leads.length;
    await saveAll(leads, { weak: true });
    if (!preview && aiSettings.enabled && timeRemaining()) {
      try {
        await classifyBatch({ env, clock, metrics: metrics.ai, canContinue: timeRemaining,
          ...(isCanary ? { candidateIds: [...new Set([...retryCandidateIds, ...metrics.candidateIds])], retryCandidateIds } : {}),
          remainingMs: () => end - +clock(), beforeWrite: canWrite });
      } catch {
        safeError("classification", null, metrics);
      }
    }
    if (!timeRemaining()) safeError("run", new Error("RUN_BUDGET_EXHAUSTED"), metrics);
    if (metrics.errors) status = "partial";
  } catch (error) {
    safeError("run", error, metrics);
    status = "failed";
  } finally {
    if (run) await runs.finish(run, status, metrics, clock());
  }
  return { status, preview, startedAt, finishedAt: clock(), ...metrics };
}

module.exports = { runAutoApplySupplyDiscovery, mongoRuns };

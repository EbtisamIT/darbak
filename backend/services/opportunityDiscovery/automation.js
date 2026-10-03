const { runSearchDiscovery, classifyUrl, canonicalUrl, TRAINING } = require("./searchDiscovery");
const { searchOpportunityUrls, configuredSearchProvider } = require("./search");
const { searchSettings } = require("./queryPack");
const { runFromSearch, saveDiscoveryLead } = require("./searchWorkflow");
const { normalize } = require("../opportunityCandidateData");
const { runPipeline } = require("./pipeline");
const { candidateAdmission } = require("./admission");

function sameAdvertTitle(a, b, source) {
  const tokens = (value) => {
    let title = normalize(value);
    for (const alias of [source.company, ...(source.metadata.aliases || [])]) title = title.replace(normalize(alias), " ");
    return new Set(title.split(" ").filter((token) => token && !["is", "looking", "for", "in", "at", "job", "application", "jobs", "saudi", "arabia", "riyadh", "jeddah"].includes(token)));
  };
  const x = tokens(a), y = tokens(b);
  return Math.min(x.size, y.size) >= 2 && [...x].filter((value) => y.has(value)).length / new Set([...x, ...y]).size >= 0.8;
}

async function recoverOfficialSources(report, sources, { provider, budget = 5 } = {}) {
  const seen = new Set(report.results.map((row) => canonicalUrl(row.url))), details = [];
  let used = 0, resolved = 0;
  // Secondary snippets are query hints ONLY; no secondary fields are copied
  // into a candidate. Unresolved items remain in the existing Discovery Leads.
  for (const lead of report.results.filter((row) => !row.recoveryAttempted &&
    (row.classification === "trusted_job_board" || row.reason === "ROBOTS_DENIED") && row.trainingHint).slice(0, 5)) {
    if (used >= budget) break;
    lead.recoveryAttempted = true;
    const hint = ` ${normalize(`${lead.title} ${lead.description}`)} `;
    const matches = sources.filter((source) => source.active !== false && source.reviewStatus === "approved" &&
      (lead.sourceKey === source.key || [source.company, ...(source.metadata.aliases || [])]
        .some((alias) => normalize(alias).length >= 4 && hint.includes(` ${normalize(alias)} `))));
    if (matches.length !== 1) { details.push({ stage: "recovery", url: lead.url, code: "COMPANY_IDENTITY_UNRESOLVED" }); continue; }
    const source = matches[0];
    const title = String(lead.title || "").replace(/["\n]/g, " ").slice(0, 160);
    const queries = [...(source.officialDomains || []).map((domain) => `site:${domain} "${title}"`), `"${source.company}" "${title}"`];
    for (const query of queries) {
      if (used >= budget) break;
      used++; report.summary.searchQueriesRun++;
      try {
        const response = await searchOpportunityUrls(query, { provider, limit: 5 });
        report.summary.searchResultsReceived += response.results.length;
        report.queries.push({ query, code: "RECOVERY_SEARCH", count: response.results.length });
        for (const row of response.results) {
          const url = canonicalUrl(row.url), trust = classifyUrl(url, sources);
          if (!url || seen.has(url)) continue;
          seen.add(url);
          // Never switch transport back to the blocked SmartRecruiters host.
          // Only an approved independent official mirror/ATS can be recovered.
          const blockedHost = lead.reason === "ROBOTS_DENIED" && (new URL(url).hostname === new URL(lead.url).hostname ||
            /(?:^|\.)smartrecruiters\.com$/i.test(new URL(url).hostname));
          const accepted = !blockedHost && trust.sourceKey === source.key && ["official_company", "official_ats"].includes(trust.classification) &&
            TRAINING.test(row.title || "") && sameAdvertTitle(lead.title, row.title, source) &&
            /\/(?:jobs?|positions?)\/|\/[a-f0-9-]{32,36}(?:\/apply)?(?:[?#]|$)/i.test(url);
          const item = { url, ...trust, title: String(row.title || "").slice(0, 300), description: String(row.description || "").slice(0, 800),
            domain: new URL(url).hostname, provider: provider.name || "external", discoveredByQueries: [query],
            firstDiscoveredAt: new Date().toISOString(), publishedAt: null, accepted, trainingHint: TRAINING.test(row.title || ""),
            reason: accepted ? "RECOVERED_OFFICIAL_URL_REQUIRES_EXTRACTION" : "RECOVERY_NOT_VERIFIED", recoveryLeadUrl: lead.url };
          report.results.push(item);
          if (accepted) resolved++;
          details.push({ stage: "recovery", url, code: item.reason });
        }
      } catch (error) { report.summary.errors++; details.push({ stage: "recovery", query, code: String(error.code || error.message).slice(0, 100) }); }
    }
  }
  report.summary.uniqueUrlsDiscovered = report.summary.urlsDiscovered = report.results.length;
  report.summary.officialUrlsAccepted = report.results.filter((row) => row.accepted).length;
  report.summary.urlsRejected = report.results.filter((row) => !row.accepted).length;
  report.summary.officialUrlsClassified = report.results.filter((row) => ["official_company", "official_ats"].includes(row.classification)).length;
  report.summary.recoveryQueries = (report.summary.recoveryQueries || 0) + used;
  report.summary.officialSourcesResolved = (report.summary.officialSourcesResolved || 0) + resolved;
  report.recoveryDetails = [...(report.recoveryDetails || []), ...details];
  return report;
}

// Manual job entry point. Scheduling can call this later; no cron is installed.
async function runOpportunityAutomation(sources, { provider, rotation = 0, settings = searchSettings(),
  onSearch = async () => {}, saveSearchLead = saveDiscoveryLead, ...pipelineOptions } = {}) {
  if (!sources && !pipelineOptions.getLogo) {
    const companies = await require("../../models/Company").find({ logoUrl: { $nin: ["", null] } }).select("name nameAr nameEn aliases contentAliases logoUrl").lean();
    pipelineOptions.getLogo = async (source) => {
      const matches = companies.filter((company) => require("../companyDirectorySeeds").companyAliasesMatchName(company, source.company));
      return matches.length === 1 ? matches[0].logoUrl : "";
    };
  }
  sources ||= await require("./management").registrySources({ activeOnly: true });
  provider ||= configuredSearchProvider();
  pipelineOptions.ingest ||= (data) => require("../opportunityCandidates").createOpportunityCandidate(data, { audit: { importedVia: "official_discovery" } });
  pipelineOptions.saveLead ||= require("./management").saveEmailLead;
  const recoveryBudget = Math.min(5, Math.max(0, settings.maxQueries - 1));
  const report = await runSearchDiscovery(sources, { provider, rotation, saveLead: saveSearchLead,
    settings: { ...settings, maxQueries: settings.maxQueries - recoveryBudget } });
  if (report.status === "failed") return { ...report, sources: [], searchReport: report };
  await recoverOfficialSources(report, sources, { provider, budget: recoveryBudget });
  for (const item of report.results.filter((row) => row.recoveryLeadUrl && !row.accepted && row.trainingHint)) await saveSearchLead(item);
  await onSearch(report);
  const result = await runFromSearch(sources, report, { ...pipelineOptions, saveSearchLead, enrichment: true });
  // Secondary results stay unverified. Their snippets are evidence only, not
  // duties, eligibility, dates, or inferred location/major fields.
  let considered = 0;
  for (const lead of report.results.filter((row) => !row.accepted && TRAINING.test(row.title || ""))) {
    const hint = ` ${normalize(lead.title)} `;
    const identities = sources.filter((source) => [source.company, ...(source.metadata.aliases || [])]
      .some((alias) => normalize(alias).length >= 4 && hint.includes(` ${normalize(alias)} `)));
    const company = identities.length === 1 ? identities[0].company : "";
    const admission = candidateAdmission({ ...lead, company }, identities.length === 1 ? identities[0] : undefined);
    if (!admission.accepted) {
      report.recoveryDetails.push({ stage: "admission", url: lead.url, code: admission.reason });
      continue;
    }
    if (considered++ >= 10) break;
    try {
      const candidate = await pipelineOptions.ingest({ title: lead.title, company,
        sourceUrl: lead.url, sourceType: "other", verificationNotes: lead.reason,
        extractionEvidence: { sourceUrl: { sourceUrl: lead.url, method: "search_lead", rawText: `${lead.title}\n${lead.description}` } } });
      if (candidate.status === "duplicate") result.summary.duplicates++;
      else if (candidate.status === "update_existing") result.summary.updates++;
      else { result.summary.newCandidates++; result.summary.candidatesCreated++; result.summary.needsVerification++; }
    } catch { result.summary.errors++; report.recoveryDetails.push({ stage: "candidate", url: lead.url, code: "CANDIDATE_CREATION_FAILED" }); }
  }
  const blocked = result.blockedSearchLeads || [];
  if (blocked.length) {
    for (const lead of blocked) Object.assign(report.results.find((row) => row.url === lead.url), lead);
    const before = new Set(report.results.map((row) => row.url));
    const searchErrorsBefore = report.summary.errors;
    await recoverOfficialSources(report, sources, { provider, budget: Math.max(0, recoveryBudget - report.summary.recoveryQueries) });
    result.summary.errors += report.summary.errors - searchErrorsBefore;
    const recovered = report.results.filter((row) => !before.has(row.url) && row.accepted && row.recoveryLeadUrl);
    for (const row of report.results.filter((item) => !before.has(item.url) && !item.accepted && item.trainingHint)) {
      if (await saveSearchLead(row)) result.summary.discoveryLeads++;
    }
    if (recovered.length) {
      const recoveredKeys = new Set(recovered.map((row) => row.sourceKey));
      const recovery = await runPipeline(sources.filter((source) => recoveredKeys.has(source.key)), {
        ...pipelineOptions, saveSearchLead, searchResults: recovered, enrichment: true,
      });
      for (const key of Object.keys(recovery.summary)) result.summary[key] += recovery.summary[key];
      result.summary.averageCompleteness = result.summary.opportunitiesEnriched ? Math.round(result.summary.completenessTotal / result.summary.opportunitiesEnriched) : 0;
      result.sources.push(...recovery.sources);
      result.blockedSearchLeads.push(...recovery.blockedSearchLeads);
    }
    for (const key of ["searchQueriesRun", "searchResultsReceived", "uniqueUrlsDiscovered", "urlsDiscovered", "officialUrlsAccepted", "urlsRejected", "officialUrlsClassified"]) {
      result.summary[key] = report.summary[key];
    }
    await onSearch(report);
  }
  result.summary.recoveryQueries = report.summary.recoveryQueries;
  result.summary.officialSourcesResolved = report.summary.officialSourcesResolved;
  result.searchReport = report;
  return result;
}
module.exports = { runOpportunityAutomation, recoverOfficialSources, sameAdvertTitle };

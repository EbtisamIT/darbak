const Supply = require("../models/AutoApplySupply");
const { classifierSettings } = require("./autoApplySupplyClassifier");

function canaryEnvironment(env, slot) {
  return {
    ...env,
    AUTO_APPLY_SUPPLY_MAX_QUERIES_PER_RUN: "8",
    AUTO_APPLY_SUPPLY_MAX_PAGES_PER_RUN: slot >= 3 ? "20" : "16",
    AUTO_APPLY_SUPPLY_MAX_NEW_CANDIDATES_PER_RUN: "25",
    AUTO_APPLY_SUPPLY_MAX_AI_CLASSIFICATIONS_PER_RUN: "10",
    AUTO_APPLY_SUPPLY_AI_ENABLED: "true",
    AUTO_APPLY_SUPPLY_SEARCH_QUERIES: [
      '"برنامج التدريب التعاوني" السعودية', '"cooperative training" Saudi Arabia applications',
      '"تدريب صيفي" السعودية التقديم', '"internship" Saudi Arabia students apply',
      '"تدريب تعاوني" "التقديم" شركة', '"graduate development program" Saudi Arabia applications',
      '"برنامج تدريب طلاب الجامعات" السعودية', '"student program" Saudi Arabia university training',
    ].join("\n"),
  };
}

function canaryReadiness(env, runs) {
  const initial = runs.find((item) => item.canarySlot === 1);
  const retried = runs.some((item) => item.canarySlot === 2);
  const followup = runs.some((item) => item.canarySlot === 3);
  const quality = runs.some((item) => item.canarySlot === 4);
  const previous = runs.find((item) => item.canarySlot === 3);
  const retryable = initial?.finishedAt && initial.metrics?.resultsFound > 0 && initial.metrics?.uniqueCandidates === 0;
  let nextSlot = null;
  if (!initial && !retried) nextSlot = 1;
  else if (!retried && retryable && env.AUTO_APPLY_SUPPLY_CANARY_RETRY_ENABLED === "true") nextSlot = 2;
  if (!followup && initial?.finishedAt && initial.metrics?.ai?.failedClassifications > 0 &&
    initial.metrics?.created === 1 && !runs.some((item) => !item.finishedAt)) nextSlot = 3;
  if (followup) nextSlot = null;
  if (!quality && previous?.finishedAt && priorCanaryIds(previous).length === 4 &&
    !runs.some((item) => !item.finishedAt)) nextSlot = 4;
  if (quality) nextSlot = null;
  return {
    canaryEnabled: env.AUTO_APPLY_SUPPLY_CANARY_ENABLED === "true",
    realSendingOff: env.AUTO_APPLY_REAL_SEND_ENABLED === "false",
    standardCollectorOff: env.AUTO_APPLY_SUPPLY_COLLECTOR_ENABLED !== "true",
    searchConfigured: Boolean(env.BRAVE_SEARCH_API_KEY?.trim() || env.DISCOVERY_SEARCH_PROVIDER_MODULE),
    openAiConfigured: Boolean(classifierSettings(env).apiKey),
    nextSlot,
  };
}

function candidateSummary(record) {
  const { classification = {} } = record;
  const facts = classification.extraction || {};
  const references = classification.evidenceReferences || [];
  return {
    company: record.companyName,
    employerName: record.employerName,
    publisherName: record.publisherName,
    sourceDomain: record.sourceDomain,
    sourceRole: record.sourceRole,
    geography: record.geographyStatus,
    discoverySourceUrl: record.discoverySourceUrl,
    officialApplicationSourceUrl: record.officialApplicationSourceUrl,
    opportunity: record.opportunityTitle,
    channelType: record.channelType,
    destination: record.destinationEmail || record.applicationUrl,
    sourceUrl: record.sourceUrl,
    status: record.verificationStatus,
    reason: record.verificationReason || "Awaiting classification or evidence review.",
    policyRule: classification.policyRule,
    cities: facts.cities || record.cities || [],
    majors: facts.majors || record.majors || [],
    fields: facts.fields || record.fields || [],
    deadline: facts.deadline || record.deadline || references.find((item) => item.field === "deadline")?.value,
    verificationEvidence: record.verificationStatus === "VERIFIED"
      ? references.filter((item) => ["channelAssessment", "emailAcceptsTrainingApplications", "isTrainingRelevant"].includes(item.field))
        .slice(0, 4).map((item) => item.quote)
      : [],
  };
}

async function canaryAudit(run) {
  const ids = [...new Set([...(run.metrics?.candidateIds || []), ...(run.metrics?.retryCandidateIds || [])])];
  const records = ids.length ? await Supply.find({ _id: { $in: ids } })
    .select("companyName employerName publisherName sourceDomain sourceRole geographyStatus discoverySourceUrl officialApplicationSourceUrl opportunityTitle channelType destinationEmail applicationUrl sourceUrl verificationStatus verificationReason cities majors fields deadline classification")
    .limit(29).lean() : [];
  const newIds = new Set(run.metrics?.candidateIds || []);
  const newRecords = run.canarySlot === 4 ? records.filter((item) => newIds.has(String(item._id))) : records;
  const counts = Object.fromEntries(Supply.verificationStatuses.map((status) => [status, 0]));
  for (const record of newRecords) counts[record.verificationStatus] += 1;
  const { candidateIds, retryCandidateIds, reprocess, ...metrics } = run.metrics || {};
  return { slot: run.canarySlot, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt,
    metrics, recordsFound: newRecords.length, counts, samples: newRecords.map(candidateSummary),
    ...(run.canarySlot === 4 ? { reprocessed: (reprocess || []).map(({ id, action, originalCompany }) => {
      const record = records.find((item) => String(item._id) === id);
      return { action, originalCompany, ...(record ? candidateSummary(record) : {}) };
    }) } : {}) };
}

function priorCanaryIds(run) {
  return [...new Set([...(run?.metrics?.candidateIds || []), ...(run?.metrics?.retryCandidateIds || [])])]
    .filter((id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id));
}

module.exports = { canaryEnvironment, canaryReadiness, canaryAudit, priorCanaryIds };

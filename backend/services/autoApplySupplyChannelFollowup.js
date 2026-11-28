const { dynamicSource, publicSearchUrl, recruitingDetail } = require("./autoApplySupplyDynamicSearch");
const { followupLinks, geographyClass, resolveEmployer } = require("./autoApplySupplyResolution");
const { extractPage, programType } = require("./autoApplySupplyExtraction");
const { allowedUrl } = require("./opportunityDiscovery/http");
const { strategyFor } = require("./opportunityDiscovery/strategies");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");

const same = (a, b) => Boolean(a && b && normalizeCompanyComparable(a) === normalizeCompanyComparable(b));
const explicitAction = /^(?:apply\b|register\b|submit\b|application form\b|تقديم|التقديم|التسجيل|قدّم|قدم)/iu;

// This helper reads only the immediate target pages. It does not return or
// enqueue the targets' outgoing links.
async function resolveApplicationChannels({ html, anchorUrl, anchorTitle, employer, publisherName, candidates,
  sources, read, canAttempt = () => true, onAttempt = () => {}, onError = () => {} }) {
  const links = followupLinks({ html, pageUrl: anchorUrl, sources, employer,
    knownUrls: candidates.map((row) => row.applicationUrl).filter(Boolean) });
  const resolved = [];
  for (const next of links) {
    if (!canAttempt()) break;
    onAttempt();
    try {
      const registered = next.source && allowedUrl(next.url, next.source) ? next.source : null;
      const source = registered || dynamicSource(next.url, employer ? { company: employer } : null);
      const adapter = strategyFor(source);
      const result = await adapter.extractJob({ url: next.url }, source, { read: (url) => read(source, url) });
      if (!result.page) continue;
      const page = result.page;
      const parsed = extractPage(page, source, { jobs: result.jobs, allowUnknown: true, quality: true });
      for (const candidate of parsed) {
        if (candidate.geographyStatus === "NON_SAUDI" || !candidate.employerName ||
          (employer && !same(candidate.employerName, employer) && !registered)) continue;
        const anchorType = programType(anchorTitle || "", anchorTitle || "");
        if (anchorType && anchorType !== candidate.trainingType) continue;
        const matchedAtsPosting = next.kind === "ats" && recruitingDetail(page.url) &&
          result.jobs.some((job) => job.actualPosting && same(job.companyName, candidate.employerName) &&
            same(job.title, candidate.opportunityTitle));
        const cta = candidate.channelType === "EMAIL" ? Boolean(candidate.emailEvidenceText) :
          explicitAction.test(candidate.applicationEvidenceText || "");
        const official = Boolean((registered || matchedAtsPosting) && cta);
        resolved.push({ ...candidate, discoverySourceUrl: anchorUrl, publisherName: publisherName || null,
          ...(official ? {
            sourceRole: matchedAtsPosting || candidate.sourceRole === "OFFICIAL_ATS" ? "OFFICIAL_ATS" : "OFFICIAL_EMPLOYER",
            sourceType: matchedAtsPosting ? "public_ats_job_page" : candidate.sourceType,
            officialApplicationSourceUrl: publicSearchUrl(page.url),
          } : { sourceRole: "OTHER", sourceType: "dynamic_search_page", officialApplicationSourceUrl: "" }),
        });
      }
    } catch (error) { onError(error); }
  }
  return resolved;
}

function storedCanaryObservation(record, sources) {
  const registered = sources.find((source) => allowedUrl(record.sourceUrl, source));
  const source = registered || dynamicSource(record.sourceUrl, { company: record.companyName });
  const identity = resolveEmployer({ source, title: record.opportunityTitle, body: record.evidenceText,
    publisherHint: record.companyName, url: record.sourceUrl });
  const quality = geographyClass({ title: record.opportunityTitle, evidence: record.evidenceText, remote: record.remote });
  const geo = quality === "UNKNOWN" && registered && /\/for-saudi-applicants(?:\/|$)/i.test(new URL(record.sourceUrl).pathname) &&
    !record.remote ? "SAUDI" : quality;
  return { ...record, ...identity, companyName: identity.employerName || "unknown", geographyStatus: geo,
    discoverySourceUrl: record.discoverySourceUrl || record.sourceUrl,
    ...(registered ? { officialApplicationSourceUrl: record.sourceUrl } : {}),
  };
}

module.exports = { resolveApplicationChannels, storedCanaryObservation };

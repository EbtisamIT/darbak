const net = require("node:net");
const { cleanOpportunityUrl } = require("./opportunityCandidateData");

const TRAINING_LISTING = /\b(?:co[ -]?op|cooperative training|internship|graduate (?:development|training) program|student training|summer training|student program)\b|تدريب تعاوني|التدريب التعاوني|تدريب صيفي|تدريب طلاب|برنامج.{0,18}(?:الطلاب|الطلبة|الخريجين)/i;
const ATS = /(?:^|\.)(?:greenhouse\.io|lever\.co|smartrecruiters\.com|myworkdayjobs\.com|oraclecloud\.com|successfactors\.(?:com|eu)|teamtailor\.com|hr\.cloud\.sap|taleo\.net|icims\.com|bayt\.com)$/i;
const SOCIAL_OR_AGGREGATOR = /(?:^|\.)(?:linkedin\.com|tiktok\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|indeed\.com|wuzzuf\.net|glassdoor\.com|wadhefa\.com|jobzaty\.com|bayt\.com)$/i;
const JOB_PATH = /\/(?:careers?|jobs?|job-?detail|job-opportunities|postings?|coop|internships?|student-opportunities|training|recruitment|application-form|apply)(?:[/_.-]|$)/i;
const SAUDI_HINT = /\b(?:saudi|ksa|riyadh|jeddah|dammam|dhahran|khobar)\b|السعودي|الرياض|جدة|الدمام|الخبر/i;
const FOREIGN_LOCATION = /\b(?:location|training in|internship in|based in|job location)\b.{0,30}\b(?:Dubai|UAE|United Arab Emirates|Qatar|Kuwait|Bahrain|Egypt|Cairo|Canada|India|London|United States|United Kingdom)\b|(?:مكان التدريب|التدريب في).{0,24}(?:دبي|الإمارات|قطر|الكويت|البحرين|مصر|القاهرة)/i;

function publicSearchUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  let url;
  try { url = new URL(value); } catch { return ""; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return "";
  const host = url.hostname.replace(/\.$/, "");
  if (net.isIP(host.replace(/^\[|\]$/g, "")) || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$/i.test(host) ||
    /\.(?:localhost|local|internal|lan|home|test|invalid|arpa|onion)$/i.test(host)) return "";
  // Every request and redirect is still resolved and checked by the pinned reader.
  try { return cleanOpportunityUrl(url.href); } catch { return ""; }
}

function relevantSearchResult(result) {
  const title = String(result.title || "");
  const snippet = String(result.description || "");
  return TRAINING_LISTING.test(title) ||
    (TRAINING_LISTING.test(snippet) && /training|career|student|application|jobs?|تدريب|طلاب|وظائف|تقديم/i.test(title));
}

function searchPriority(result) {
  const url = new URL(result.url);
  if (SOCIAL_OR_AGGREGATOR.test(url.hostname)) return 0;
  return (ATS.test(url.hostname) ? 4 : 0) + (/\.gov\.sa$/i.test(url.hostname) ? 4 : /\.sa$/i.test(url.hostname) ? 2 : 0) +
    (JOB_PATH.test(url.pathname) ? 3 : 0) + (SAUDI_HINT.test(result.title + " " + result.description) ? 1 : 0) + 1;
}

function recruitingDetail(value) {
  const url = new URL(value);
  return !SOCIAL_OR_AGGREGATOR.test(url.hostname) &&
    (JOB_PATH.test(url.pathname) || (ATS.test(url.hostname) && (url.pathname.split("/").filter(Boolean).length >= 2 ||
      /\/jobreqcareer\/?$/i.test(url.pathname) && /^\d+$/.test(url.searchParams.get("jobId") || ""))));
}

function dynamicSource(value, employer) {
  const url = new URL(value);
  // Origin scope allows same-origin public redirects only. This is not a trusted
  // source registration and the collector never follows links from this source.
  return { key: "dynamic:" + url.hostname, company: employer?.company || "", sourceType: "untrusted_search_page",
    atsProvider: "generic", metadata: { scopes: [url.origin + "/"], aliases: employer?.metadata?.aliases || [], maxRequests: 8 } };
}

function clearlyForeign(evidence) {
  return FOREIGN_LOCATION.test(evidence) && !SAUDI_HINT.test(evidence);
}

module.exports = { publicSearchUrl, relevantSearchResult, searchPriority, recruitingDetail, dynamicSource, clearlyForeign };

const cheerio = require("cheerio");
const { publicSearchUrl } = require("./autoApplySupplyDynamicSearch");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");

const ROLES = ["OFFICIAL_EMPLOYER", "OFFICIAL_ATS", "SECONDARY_DISCOVERY", "OTHER"];
const GEOGRAPHIES = ["SAUDI", "REMOTE_SAUDI_ELIGIBLE", "UNKNOWN", "NON_SAUDI"];
const PUBLISHER = /وظائف السعودية|sejel|jobzaty|wadh(?:aef|efa)|linkedin|indeed|glassdoor|wuzzuf|bayt|أخبار|news portal/i;
const ATS = /(?:^|\.)(?:greenhouse\.io|lever\.co|smartrecruiters\.com|myworkdayjobs\.com|oraclecloud\.com|successfactors\.(?:com|eu)|teamtailor\.com|hr\.cloud\.sap)$/i;
const FORM = /^(?:docs\.google\.com|forms\.gle|forms\.(?:office|microsoft)\.com)$/i;
const PROGRAM = /training|co[ -]?op|internship|graduate|students?|تدريب|تعاوني|الطلبة|الطلاب|الخريجين/i;
const ACTION = /apply|application|register|careers?|jobs?|opportunit|internship|co[ -]?op|training|تقديم|التسجيل|قد[ّ]?م|الوظائف|فرص التدريب/i;
const EXCLUDE = /privacy|terms|cookie|sign[ -]?in|login|logout|support|contact us|سياسة|الخصوصية|تسجيل الدخول|تواصل معنا/i;
const REMOTE = /\b(?:remote|telecommute|work from home)\b|عن ب[ُ]?عد/i;
const SAUDI = /\b(?:Saudi Arabia|KSA|Riyadh|Jeddah|Dammam|Dhahran|Khobar|Yanbu|Jubail|Makkah|Medina|Abha|Tabuk)\b|السعودية|الرياض|جدة|الدمام|الظهران|الخبر|ينبع|الجبيل|مكة|المدينة المنورة|أبها|تبوك/i;
const REMOTE_ACCEPTANCE = /\b(?:applicants?|candidates?|eligible|open to|residents?|based in|remote (?:work |training )?(?:in|from|within))\b.{0,48}\b(?:Saudi Arabia|KSA)\b|(?:للمقيمين|للسعوديين|للمتقدمين|عن ب[ُ]?عد من داخل|التقديم من).{0,32}السعودي|للسعوديين/i;
const FOREIGN = /\b(?:Sweden|Stockholm|Gothenburg|Norway|Denmark|Germany|France|Finland|Netherlands|Switzerland|United Arab Emirates|Dubai|Abu Dhabi|London|United Kingdom|United States|Canada|India|Egypt|Cairo|Qatar|Kuwait|Bahrain|Jordan|Oman|Australia|Singapore)\b|السويد|ستوكهولم|النرويج|الدنمارك|ألمانيا|فرنسا|الإمارات|دبي|أبوظبي|مصر|القاهرة|قطر|الكويت|البحرين|الأردن|عمان/i;
const PLACE = /(?:\b(?:in|location|located|based|onsite|at)\b|في|الموقع|مكان التدريب|مدينة التدريب)/i;
const HQ = /headquarters|head office|corporate office|المقر الرئيسي|المركز الرئيسي/i;

const normalize = (value) => normalizeCompanyComparable(String(value || ""));
const host = (value) => { try { return new URL(value).hostname; } catch { return ""; } };
const hostnameMatches = (value, domain) => Boolean(value && domain && (value === domain || value.endsWith("." + domain)));
const recognizedAts = (value) => ATS.test(host(value));
const recognizedForm = (value) => FORM.test(host(value)) && (host(value) !== "docs.google.com" || new URL(value).pathname.startsWith("/forms/"));

function isPublisher(name, url) {
  return PUBLISHER.test(name || "") || PUBLISHER.test(host(url)) || /(?:^|\.)wadhaef-sa\.com$/i.test(host(url));
}

function sourceRole(source, url) {
  if (source?.reviewStatus === "approved" && source?.sourceType !== "untrusted_search_page") {
    return recognizedAts(url) || source.sourceType === "ats" ? "OFFICIAL_ATS" : "OFFICIAL_EMPLOYER";
  }
  return isPublisher(source?.company, url) ? "SECONDARY_DISCOVERY" : "OTHER";
}

function namedEmployer(value, { title = false } = {}) {
  const line = String(value || "").trim();
  if (!PROGRAM.test(line)) return "";
  const arabic = line.match(/(?:لدى\s+|في\s+(?:شركة|مجموعة(?:\s+شركات)?|مؤسسة|هيئة|بنك)\s+|بمجموعة(?:\s+شركات)?\s+|بشركة\s+)(.{2,130}?)(?=\s+[–—|-]|[|،:\n]|$)/u)?.[1];
  const english = title ? line.match(/\bat\s+([A-Z][\p{L}\p{N} &.'’-]{1,100}?)(?=\s+(?:[–—|-]|in\b)|[|,:\n]|$)/u)?.[1] : null;
  const hit = arabic || english;
  const name = hit?.trim().replace(/^(?:شركة|مجموعة شركات|مجموعة)\s+/u, "").replace(/[.!؟]+$/u, "");
  return name && !PUBLISHER.test(name) && name.split(/\s+/).length <= 12 ? name : "";
}

function resolveEmployer({ source, title, body, structuredEmployer, publisherHint, url, officialEmployer }) {
  const role = sourceRole(source, url);
  const publisherName = role === "SECONDARY_DISCOVERY" ?
    [publisherHint, source?.company, String(title || "").split("|").at(-1)?.trim()].find((value) => value && PUBLISHER.test(value)) || publisherHint || null : null;
  const structured = structuredEmployer && !PUBLISHER.test(structuredEmployer) && normalize(structuredEmployer) !== normalize(publisherName) ? structuredEmployer : "";
  const explicitlyNamed = namedEmployer(title, { title: true }) || String(body || "").split("\n").slice(0, 25).map((line) => namedEmployer(line)).find(Boolean);
  const approved = ["OFFICIAL_EMPLOYER", "OFFICIAL_ATS"].includes(role) ? source.company : "";
  const employerName = (structured || officialEmployer || approved || explicitlyNamed || "").trim() || null;
  return { employerName, publisherName, sourceDomain: host(url), sourceRole: role };
}

function geographyClass({ title, evidence, countries = [], remote = false } = {}) {
  const heading = String(title || "");
  const body = String(evidence || "");
  const segments = [heading, ...body.split(/[\n!?؟؛]|[.](?=\s|$)/u)].filter((line) => !HQ.test(line));
  const remoteListing = remote === true || REMOTE.test(heading + "\n" + body);
  const remoteEligible = remoteListing && segments.some((line) => REMOTE_ACCEPTANCE.test(line) &&
    !/\b(?:not eligible|cannot apply|excluding)\b|غير مؤهل|باستثناء|لا يقبل/i.test(line));
  const explicitCountry = countries.filter((value) => typeof value === "string" && value.trim());
  const saudiCountry = explicitCountry.some((value) => /^(?:SA|SAU)$/i.test(value.trim()) || SAUDI.test(value));
  const foreignCountry = explicitCountry.some((value) => !/^(?:SA|SAU)$/i.test(value.trim()) && !SAUDI.test(value));
  const saudiPlace = segments.some((line) => SAUDI.test(line) && (PLACE.test(line) || /^\s*(?:السعودية|Saudi Arabia)\s*$/i.test(line))) ||
    heading.split(/\s[–—-]\s|[|]/u).slice(1).some((part) => SAUDI.test(part) && part.trim().split(/\s+/).length <= 3);
  const foreignPlace = segments.some((line) => FOREIGN.test(line) && PLACE.test(line));
  if (remoteEligible) return "REMOTE_SAUDI_ELIGIBLE";
  if (FOREIGN.test(heading) && PLACE.test(heading) && !SAUDI.test(heading)) return "NON_SAUDI";
  if ((foreignCountry || foreignPlace) && !(saudiCountry || saudiPlace)) return "NON_SAUDI";
  if (remoteListing || ((foreignCountry || foreignPlace) && (saudiCountry || saudiPlace))) return "UNKNOWN";
  return saudiCountry || saudiPlace ? "SAUDI" : "UNKNOWN";
}

function safeFollowup(value, pageUrl, sources, employer) {
  let url;
  try { url = publicSearchUrl(new URL(value, pageUrl).href); } catch { return null; }
  if (!url || url === publicSearchUrl(pageUrl)) return null;
  const u = new URL(url);
  if (EXCLUDE.test(u.pathname)) return null;
  const match = sources.find((source) => source.reviewStatus === "approved" && normalize(source.company) === normalize(employer) &&
    [...(source.officialDomains || []), ...(source.careerDomains || [])].some((domain) => u.hostname === domain));
  if (match) return { url, kind: "employer", source: match };
  if (recognizedAts(url)) return { url, kind: "ats" };
  if (recognizedForm(url)) return { url, kind: "form" };
  const original = host(pageUrl);
  if (hostnameMatches(u.hostname, original) && !isPublisher("", pageUrl) && /career|job|apply|train|intern|coop|student/i.test(u.pathname)) {
    return { url, kind: "same_host" };
  }
  return null;
}

function followupLinks({ html, pageUrl, knownUrls = [], sources = [], employer }) {
  const $ = cheerio.load(html || "");
  const links = [];
  for (const link of $("main a[href], article a[href], [role='main'] a[href], body a[href]").toArray()) {
    const node = $(link);
    const label = (node.text().trim() || node.attr("aria-label") || "").trim();
    if (!ACTION.test(label) || EXCLUDE.test(label) || node.is("[disabled],[aria-disabled=true],.disabled")) continue;
    links.push({ value: node.attr("href"), rank: /apply|application|register|تقديم|التسجيل/i.test(label) ? 1 : 2 });
  }
  const unique = new Map();
  for (const item of [...knownUrls.map((value) => ({ value, rank: 0 })), ...links].sort((a, b) => a.rank - b.rank)) {
    const next = safeFollowup(item.value, pageUrl, sources, employer);
    if (next && !unique.has(next.url)) unique.set(next.url, next);
    if (unique.size >= 3) break;
  }
  return [...unique.values()];
}

module.exports = { ROLES, GEOGRAPHIES, recognizedAts, sourceRole, resolveEmployer, geographyClass, followupLinks, safeFollowup };

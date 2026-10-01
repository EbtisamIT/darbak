const { cities: cityDictionary, majorGroups } = require("../../src/data/trainingVocabulary.json");
const { normalize, cleanOpportunityUrl } = require("./opportunityCandidateData");
const { text, trainingType, isoDate } = require("./opportunityDiscovery/extract");
const { assessEnrichment } = require("./opportunityEnrichmentAssessment");

const majorAliases = {
  "علوم الحاسب": ["Computer Science", "CS", "علوم حاسب"],
  "نظم المعلومات": ["Information Systems", "IS"],
  "نظم المعلومات الإدارية": ["Management Information Systems", "MIS"],
  "تقنية المعلومات": ["Information Technology", "IT"],
  "هندسة البرمجيات": ["Software Engineering"], "هندسة الحاسب": ["Computer Engineering"],
  "الذكاء الاصطناعي": ["Artificial Intelligence", "AI"],
  "الأمن السيبراني": ["Cybersecurity", "Cyber Security"], "علم البيانات": ["Data Science"],
  "المحاسبة": ["Accounting"], "المالية": ["Finance"], "التسويق": ["Marketing"],
  "إدارة الأعمال": ["Business Administration"], "الموارد البشرية": ["Human Resources", "HR"],
  "الهندسة الكهربائية": ["Electrical Engineering"], "الهندسة الميكانيكية": ["Mechanical Engineering"],
  "الهندسة الصناعية": ["Industrial Engineering"], "الهندسة المدنية": ["Civil Engineering"],
};
const cityAliases = { الرياض: ["Riyadh"], جدة: ["Jeddah", "Jiddah", "جده"], الدمام: ["Dammam"],
  الظهران: ["Dhahran"], الخبر: ["Khobar", "Al Khobar"], الجبيل: ["Jubail"], ينبع: ["Yanbu"],
  "مكة المكرمة": ["Makkah", "Mecca"], "المدينة المنورة": ["Madinah", "Medina"], تبوك: ["Tabuk"],
  "مدينة الملك عبدالله الاقتصادية": ["King Abdullah Economic City", "KAEC"], الخرج: ["Al Kharj"], الأحساء: ["Al Ahsa"] };
const majorDictionary = [...new Set(majorGroups.flatMap((group) => group.subMajors))];
const unique = (values) => [...new Set(values.filter(Boolean))];
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function dictionaryMatches(value, dictionary, aliases) {
  let remaining = ` ${normalize(value)} `;
  const matched = [];
  const entries = dictionary.flatMap((canonical) => [canonical, ...(aliases[canonical] || [])].map((label) => ({ canonical, label: normalize(label),
    acronym: /^[A-Z]{1,3}$/.test(label) ? label : null })))
    .sort((a, b) => b.label.length - a.label.length);
  for (const { canonical, label, acronym } of entries) {
    // "is"/"it" in English prose are not the IS/IT academic abbreviations.
    if (acronym && !new RegExp(`\\b${acronym}\\b`).test(value)) continue;
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(label)}(?=$|[^\\p{L}\\p{N}])`, "gu");
    if (regex.test(remaining)) { matched.push(canonical); remaining = remaining.replace(regex, " "); }
  }
  return unique(matched);
}
function normalizeMajors(raw) {
  const joined = raw.join("\n");
  if (/\ball (?:academic )?(?:majors|disciplines|fields of study)\b|جميع التخصصات|كافة التخصصات/i.test(joined)) return { majors: [], majorScope: "all" };
  const majors = unique(raw.flatMap((line) => dictionaryMatches(line, majorDictionary, majorAliases)));
  const broad = /(?:business|engineering|technical)[ -]related (?:majors|fields|disciplines)|تخصصات (?:الأعمال|الهندسة)|التخصصات (?:الإدارية|الهندسية)/i.test(joined);
  return { majors, majorScope: broad ? "broad" : majors.length ? "specific" : "unknown" };
}
function normalizeCities(raw) {
  return unique(raw.flatMap((line) => {
    const matches = dictionaryMatches(line, cityDictionary, cityAliases);
    // Preserve unknown explicit locations rather than inventing a Saudi city.
    return matches.length ? matches : [line.trim()];
  }));
}
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
function explicitDate(value) {
  const iso = value.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (iso) return isoDate(iso);
  const months = [...MONTHS, ...AR_MONTHS].join("|");
  const match = value.match(new RegExp(`\\b(\\d{1,2})\\s+(${months})\\s+(20\\d{2})`, "i"));
  const reverse = !match && value.match(new RegExp(`(${months})\\s+(\\d{1,2}),?\\s+(20\\d{2})`, "i"));
  if (!match && !reverse) return null;
  const name = (match ? match[2] : reverse[1]).toLowerCase();
  const month = Math.max(MONTHS.indexOf(name), AR_MONTHS.indexOf(name)) + 1;
  return isoDate(`${(match || reverse)[3]}-${String(month).padStart(2, "0")}-${String(match ? match[1] : reverse[2]).padStart(2, "0")}`);
}
function labeledFacts(rawContent) {
  const result = {}, evidence = {};
  const labels = {
    postedAt: /^(?:date posted|posted on|publication date|تاريخ النشر|تاريخ الإعلان)\s*[:：-]?\s*/i,
    deadline: /^(?:applications? close(?:s)?(?: on)?|application deadline|closing date|آخر موعد(?: للتقديم)?|ينتهي التقديم في)\s*[:：-]?\s*/i,
    trainingStartDate: /^(?:training starts?(?: on)?|start date|program starts?(?: on)?|تاريخ بداية التدريب|بداية التدريب)\s*[:：-]?\s*/i,
    duration: /^(?:duration|training duration|program duration|مدة التدريب|مدة البرنامج)\s*[:：-]?\s*/i,
    cities: /^(?:locations?|cities|city|work location|المدينة|المدن|موقع التدريب|مكان التدريب)\s*[:：]\s*/i,
  };
  for (const line of String(rawContent || "").split("\n").map((line) => line.trim())) {
    for (const [key, regex] of Object.entries(labels)) {
      if (!regex.test(line) || result[key]) continue;
      const value = line.replace(regex, "");
      const parsed = key === "cities" ? value.split(/\s*(?:;|\||،|\n)\s*/).filter(Boolean) : key === "duration" ? value.slice(0, 240) : explicitDate(value);
      if (parsed) { result[key] = parsed; evidence[key] = { rawText: line.slice(0, 6000), method: "labeled_text" }; }
    }
  }
  return { result, evidence };
}
function officialLogo(value, source) {
  try {
    const url = new URL(cleanOpportunityUrl(value));
    return url.protocol === "https:" && !url.port && (source.officialDomains || []).includes(url.hostname) ? url.href : "";
  } catch { return ""; }
}

// Facts come only from the fetched advert. Search snippets are deliberately not
// accepted here; their sole role is discovering URLs and audit metadata.
function enrichExtractedJob(job, source, { logo = "", fetchMethod = "http", now = new Date() } = {}) {
  const rawContent = String(job.rawContent || job.description || "").slice(0, 50000);
  const labeled = labeledFacts(rawContent), original = job.extractionEvidence || {};
  if (!labeled.result.duration) {
    const explicitDuration = rawContent.match(/\b(?:\d{1,2}|one|two|three|four|five|six|nine|twelve)[ -](?:months?|weeks?)[ -](?:internship|training|program(?:me)?)\b|(?:تدريب|برنامج)[^\n.]{0,30}\bلمدة\s+\d{1,2}\s*(?:أشهر|شهور|أسابيع)/i)?.[0];
    if (explicitDuration) { labeled.result.duration = explicitDuration; labeled.evidence.duration = { method: "explicit_duration_text", rawText: explicitDuration }; }
  }
  const sourceUrl = cleanOpportunityUrl(job.sourceUrl);
  const method = fetchMethod === "ats_api" ? "ats_api" : fetchMethod === "structured_data" ? "structured_data" : fetchMethod === "browser" ? "browser_html" : "html";
  const enriched = { ...job, rawContent, sourceUrl, enrichmentVersion: 1, enrichedAt: now,
    company: source.company, companyNormalized: normalize(source.company),
    title: text(job.title).replace(/\s+/g, " ").trim().slice(0, 300),
    companyLogo: logo || officialLogo(job.companyLogo, source), extractionEvidence: { ...original } };
  for (const [key, entry] of Object.entries(enriched.extractionEvidence)) enriched.extractionEvidence[key] = { ...entry, sourceUrl: entry.sourceUrl || sourceUrl };
  for (const key of ["postedAt", "deadline", "trainingStartDate", "duration", "cities"]) {
    if ((!enriched[key] || !enriched[key].length) && labeled.result[key]) {
      enriched[key] = labeled.result[key]; enriched.extractionEvidence[key] = { sourceUrl, ...labeled.evidence[key] };
    }
  }
  const rawMajors = unique([...(job.majors || []), ...(job.requirements || []).filter((line) =>
    /\b(?:majors?|degree|bachelor|discipline|field of study|(?:students|graduates) in)\b|تخصص|بكالوريوس/i.test(line))]);
  enriched.rawMajors = rawMajors;
  Object.assign(enriched, normalizeMajors(rawMajors));
  enriched.rawCities = (enriched.cities || []).filter((v) => typeof v === "string");
  enriched.cities = normalizeCities(enriched.rawCities);
  const detected = trainingType(job.title, job.description || rawContent);
  enriched.programType = detected === "graduate" ? "graduate_program" : detected && /student program|university program|برنامج (?:طلاب|جامعي)/i.test(job.title) ? "student_program" : detected || "unknown";
  enriched.responsibilities = unique((job.responsibilities || []).map((v) => text(v).slice(0, 2000))).slice(0, 80);
  enriched.requirements = unique((job.requirements || []).map((v) => text(v).slice(0, 2000))).slice(0, 80);
  const lines = String(job.description || rawContent).split("\n").map((line) => line.trim()).filter((line) => line.length > 35);
  const relevant = lines.filter((line) => /intern|co[ -]?op|student|trainee|تدريب|متدرب|طلاب/i.test(line));
  enriched.cardDescription = ((relevant.length ? relevant : lines).slice(0, 2).join(" ") || text(job.description || rawContent)).slice(0, 450);
  for (const key of ["title", "company", "programType", "cities", "majors", "responsibilities", "requirements", "postedAt", "deadline", "trainingStartDate", "duration", "applicationUrl", "companyLogo", "description"]) {
    const value = key === "majors" ? rawMajors : key === "description" ? enriched.cardDescription : enriched[key];
    if (!value || (Array.isArray(value) && !value.length)) continue;
    if (!enriched.extractionEvidence[key]) enriched.extractionEvidence[key] = { sourceUrl,
      method: key === "company" ? "approved_source_registry" : key === "companyLogo" && logo ? "darbak_company" : method,
      rawText: (Array.isArray(value) ? value.join("\n") : String(value)).slice(0, 6000) };
  }
  enriched.extractionEvidence.sourceUrl = { sourceUrl, method: "fetched_source", rawText: sourceUrl };
  enriched.extractionEvidence.companyNormalized = { sourceUrl, method: "company_normalization", rawText: source.company };
  if (job.remote === true) enriched.extractionEvidence.remote = { sourceUrl, method, rawText: "remote=true" };
  return enriched;
}

async function enrichOpportunityUrl({ url, source, searchMetadata }, { reader, browserRenderer, logo = "", now = new Date() } = {}) {
  const { createReader } = require("./opportunityDiscovery/http");
  const { extractOpportunity, verifyExtracted } = require("./opportunityDiscovery/stages");
  const activeReader = reader || createReader(source);
  const extracted = await extractOpportunity({ url }, source, activeReader, { browserRenderer });
  const results = [];
  for (const job of extracted.jobs) {
    const result = await verifyExtracted(job, source, activeReader, { now, logo, enrichment: true, fetchMethod: extracted.fetchMethod });
    results.push({ ...result, searchMetadata, fetchMethod: extracted.fetchMethod });
  }
  return { results, reason: extracted.reason, fetchMethod: extracted.fetchMethod };
}
module.exports = { enrichExtractedJob, enrichOpportunityUrl, normalizeMajors, normalizeCities, labeledFacts, explicitDate, officialLogo, assessEnrichment };

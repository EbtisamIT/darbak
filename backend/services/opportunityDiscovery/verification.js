const { cleanOpportunityUrl } = require("../opportunityCandidateData");
const { allowedUrl } = require("./http");
const { trainingType, CLOSED, POOL, emails, sameCompany, isoDate } = require("./extract");

const SCORE = { official: 30, url: 20, company: 15, open: 15, deadline: 5, responsibilities: 5, requirements: 5, recent: 5,
  closedPenalty: 50, urlPenalty: 40, companyPenalty: 40 };
const MAX_AGE_DAYS = 180;
function freshness(job, now = new Date()) {
  const posted = isoDate(job.postedAt), deadline = isoDate(job.deadline);
  const age = posted ? (now - new Date(posted)) / 86400000 : null;
  const years = [...String(job.title).matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  const cycleYears = [...String(job.description || "").matchAll(/(?:intake|cohort|applications? for|summer training|internship program(?:me)?|دفعة|للعام|التدريب الصيفي لعام)\s[^.\n]{0,25}?\b(20\d{2})\b/gi)].map((m) => Number(m[1]));
  // A future deadline alone does not prove that an old advert was reopened.
  if ((age !== null && age > MAX_AGE_DAYS) || ([...years, ...cycleYears].some((y) => y < now.getUTCFullYear()) && !(age !== null && age >= 0 && age <= 30))) return { skip: true, reason: "STALE_POSTING" };
  if (age !== null && age < -1) return { skip: true, reason: "FUTURE_POSTED_DATE" };
  return { skip: false, posted, deadline, recent: age !== null && age >= 0 && age <= 30, dateVerified: Boolean(posted && age >= 0) };
}
function confidence(data, recent) {
  const v = data.verification;
  let score = (v.officialSource ? SCORE.official : 0) + (v.urlWorks === true ? SCORE.url : v.urlWorks === false ? -SCORE.urlPenalty : 0) +
    (v.companyVerified ? SCORE.company : -SCORE.companyPenalty) + (v.appearsOpen === true ? SCORE.open : v.appearsOpen === false ? -SCORE.closedPenalty : 0) +
    (data.deadline ? SCORE.deadline : 0) + (data.responsibilities.length ? SCORE.responsibilities : 0) +
    (data.requirements.length ? SCORE.requirements : 0) + (recent ? SCORE.recent : 0);
  return Math.max(0, Math.min(100, score));
}
async function verifyJob(job, source, reader, { now = new Date(), logo = "" } = {}) {
  const type = trainingType(job.title, job.description || "");
  if (!type || !job.actualPosting || POOL.test(job.title || "")) return { skip: "NOT_A_TRAINING_POSTING" };
  if (!sameCompany(job.companyName, source)) return { skip: "COMPANY_MISMATCH" };
  if (job.countries?.length && !job.countries.some((v) => /^(SA|SAU|Saudi Arabia|Saudi|المملكة العربية السعودية|السعودية)$/i.test(v.trim()))) return { skip: "OUTSIDE_SAUDI_ARABIA" };
  const fresh = freshness(job, now); if (fresh.skip) return { skip: fresh.reason };
  if (!allowedUrl(job.sourceUrl, source) || !allowedUrl(job.applicationUrl, source)) return { skip: "NO_APPROVED_APPLICATION_URL" };
  const notes = []; let urlWorks = null, appClosed = false;
  try { const page = await reader.read(job.applicationUrl); urlWorks = true; appClosed = CLOSED.test(page.text); }
  catch (e) { urlWorks = /^HTTP_(404|410)$/.test(e.code) ? false : null; notes.push(`application verification: ${e.code || "FETCH_FAILED"}`); }
  const closed = job.closed || CLOSED.test(job.description) || appClosed || (fresh.deadline && fresh.deadline.slice(0, 10) < now.toISOString().slice(0, 10));
  const data = {
    title: job.title.slice(0, 300), company: source.company, programType: type, sourceType: source.sourceType,
    companyLogo: logo || (allowedUrl(job.companyLogo, source) ? cleanOpportunityUrl(job.companyLogo) : ""),
    description: String(job.description || "").slice(0, 15000), rawContent: String(job.rawContent || job.description || "").slice(0, 50000),
    responsibilities: (job.responsibilities || []).slice(0, 80), requirements: (job.requirements || []).slice(0, 80),
    majors: (job.majors || []).slice(0, 80), cities: (job.cities || []).slice(0, 80), remote: job.remote === true,
    applicationUrl: cleanOpportunityUrl(job.applicationUrl), sourceUrl: cleanOpportunityUrl(job.sourceUrl),
    postedAt: fresh.posted, deadline: fresh.deadline, trainingStartDate: isoDate(job.trainingStartDate),
    verification: { urlWorks, officialSource: true, companyVerified: true, dateVerified: fresh.dateVerified || null,
      appearsOpen: closed ? false : job.applyVisible && urlWorks && !POOL.test(job.description) ? true : null },
    discoveredEmails: emails(job.rawContent || job.description, cleanOpportunityUrl(job.sourceUrl)),
  };
  if (!fresh.posted) notes.push("Posting date not supplied; freshness needs admin review.");
  if (!job.countries?.length) notes.push("Location/country may need review; source country is not an inferred job location.");
  data.confidenceScore = confidence(data, fresh.recent);
  data.aiNotes = `Deterministic discovery v1.5; source=${source.key}; adapter=${source.metadata.adapter}. ${notes.join(" ")}`;
  return { data };
}
module.exports = { SCORE, MAX_AGE_DAYS, freshness, confidence, verifyJob };

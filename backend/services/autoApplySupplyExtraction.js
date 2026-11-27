const cheerio = require("cheerio");
const { createHash } = require("node:crypto");
const { TRAINING, text, isoDate, trainingType, structuredJobs, sameCompany } = require("./opportunityDiscovery/extract");
const { allowedUrl } = require("./opportunityDiscovery/http");
const { normalizeEmail } = require("./autoApplyEmailNetwork");
const { cleanOpportunityUrl } = require("./opportunityCandidateData");
const { clearlyForeign, publicSearchUrl, relevantSearchResult, recruitingDetail } = require("./autoApplySupplyDynamicSearch");

const SAUDI = /\b(?:saudi(?: arabia| applicants| arabian)?|KSA|riyadh|jeddah|dammam|dhahran|khobar|makkah)\b|السعودي(?:ة|ين|ون)?|الرياض|جدة|الدمام|الظهران|الخبر|مكة/i;
const REMOTE = /\b(?:remote(?: work| internship| training| position)?|telecommute|work from home)\b|عن بُ?عد|عن بعد/i;
const SAUDI_REMOTE = /(?:open to|eligible|applicants?|candidates?|participants?|remote(?: work| internship| training)?\s+(?:in|from|within)).{0,42}(?:Saudi Arabia|KSA)|(?:Saudi Arabia|KSA).{0,28}(?:only|residents?|applicants?|candidates?|eligible)|للسعوديين|(?:للمقيمين|للمتقدمين|عن بعد من داخل|التقديم من).{0,28}السعودي/i;
const APPLY = /apply|application|register|submit|تقديم|تقدّم|التسجيل|سجل/i;
const APPLY_LINK = /^(?:apply\b|application form\b|register\b|submit\b|تقديم(?:\s|$)|التقديم|قدّم|قدم|تقدّم|سجّل|سجل|التسجيل)/iu;
const FORM_URL = /(?:^|\.)forms\.(?:office|microsoft)\.com$|^forms\.gle$|^form\.typeform\.com$|(?:^|\.)jotform\.com$/i;
const ATS_HOST = /(?:^|\.)(?:greenhouse\.io|lever\.co|smartrecruiters\.com|myworkdayjobs\.com|oraclecloud\.com|successfactors\.com|teamtailor\.com)$/i;
const SHARED_PORTAL = /^(?:\/|\/(?:en|ar)\/?)$|\/(?:careers|jobs|apply|job-opportunities|careers-home)\/?$/i;
const EMAIL_PATTERN = /[a-z0-9.!#$%&'*+/=?^_{}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UNIVERSITY = /\b(?:university student|student) program(?:me)?s?\b|برنامج.{0,20}(?:طلاب|طلبة|الطلبة|الجامعات)/i;
const GRADUATE = /\bgraduate (?:development |training )?program(?:me)?s?\b|برنامج.{0,20}الخريجين/i;
const LEAD_TRAINING = /co[ -]?op(?:erative)?\s+(?:training|program|programme)|internship|summer training|تدريب تعاوني|تدريب صيفي/i;

const cap = (value, length) => String(value || "").trim().slice(0, length);
function secureUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, base);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") ? url.href : "";
  } catch {
    return "";
  }
}

function channelForUrl(value) {
  const url = new URL(value);
  if (["darbak.space", "www.darbak.space"].includes(url.hostname) &&
    /^\/(?:apply\/|where-to-train\/opportunity\/)/i.test(url.pathname)) return "DARBAK_APPLICATION";
  if (FORM_URL.test(url.hostname) || (url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/")) ||
    /\/(?:application-form|registration-form)(?:\/|$)/i.test(url.pathname)) return "EXTERNAL_FORM";
  return "COMPANY_PORTAL";
}

function programType(title, body) {
  if (/\b(?:co[ -]?op|cooperative)\s+(?:training|program(?:me)?|internship)\b|(?:التدريب|تدريب)\s+(?:التعاوني|تعاوني)/i.test(title) && !/\btrainer\b|مدرب/i.test(title)) return "coop";
  if (GRADUATE.test(title) && /\b(?:training|rotations?|development|trainees?|mentorship)\b|تدريب|تطوير/i.test(body)) return "graduate";
  if (UNIVERSITY.test(title) && /\b(?:training|internship|cooperative|practical)\b|تدريب/i.test(body)) return "student_program";
  return trainingType(title, body);
}

function geography(job, evidence, sourceUrl) {
  const structuredSaudi = (job.countries || []).some((item) => /^(?:SA|SAU)$/i.test(item) || SAUDI.test(item));
  const remote = job.remote === true || REMOTE.test(evidence);
  if (remote) {
    const explicitlyEligible = evidence.split(/[.!?؟\n؛]+/u).some((part) => SAUDI_REMOTE.test(part));
    return explicitlyEligible ? { remote: true } : null;
  }
  const scopedToSaudi = /\/for-saudi-applicants(?:\/|$)/i.test(new URL(sourceUrl).pathname);
  return structuredSaudi || SAUDI.test(evidence) || scopedToSaudi ? {} : null;
}

function emailChannels(rawText, mailLinks = []) {
  const emails = new Map();
  for (const match of String(rawText).matchAll(EMAIL_PATTERN)) {
    const email = normalizeEmail(match[0]);
    const context = rawText.slice(Math.max(0, match.index - 220), match.index + match[0].length + 220);
    if (!emails.has(email)) emails.set(email, cap(context, 1500));
  }
  for (const { email, context } of mailLinks) {
    if (!emails.has(email)) emails.set(email, cap(context || email, 1500));
  }
  return [...emails].slice(0, 20).map(([destinationEmail, emailEvidenceText]) => ({
    channelType: "EMAIL", destinationEmail, emailEvidenceText,
  }));
}

function dateValue(value, closing = false) {
  const valid = isoDate(value);
  if (!valid) return null;
  if (closing && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const endInRiyadh = new Date(value + "T23:59:59.999+03:00");
    return endInRiyadh.toISOString();
  }
  return valid;
}

function linkedChannels($, root, pageUrl) {
  const urls = [];
  const mailLinks = [];
  root.find("a[href]").each((_, element) => {
    if (urls.length + mailLinks.length >= 30) return false;
    const link = $(element);
    if (link.is("[disabled],[aria-disabled=true],.disabled")) return;
    const href = link.attr("href");
    const label = cap(text(link.text() || link.attr("aria-label")), 300);
    const context = cap(text(link.closest("p,li,dd").text()) || label, 1500);
    if (/^mailto:/i.test(href)) {
      const email = normalizeEmail(href);
      if ((email.match(EMAIL_PATTERN) || [])[0] === email) mailLinks.push({ email, context: context + " " + email });
      return;
    }
    if (!APPLY_LINK.test(label) || /privacy|policy|instructions|faq|سياسة|تعليمات/i.test(label)) return;
    const applicationUrl = secureUrl(href, pageUrl);
    if (applicationUrl) urls.push({ channelType: channelForUrl(applicationUrl), applicationUrl, applicationEvidenceText: context });
  });
  return { urls, mailLinks };
}

function opportunityChannels(job, page, source, { body, urls, mailLinks, pageTitle, query, sourceType, diagnostics, allowUnknown }) {
  const skip = (reason) => {
    if (diagnostics) diagnostics[reason] += 1;
    return [];
  };
  const title = cap(job.title, 300);
  const evidence = [title, body].filter(Boolean).join("\n");
  const location = geography(job, evidence, page.url);
  const type = programType(title, evidence);
  if (!type) return skip("noProgram");
  const dynamic = source.sourceType === "untrusted_search_page";
  const companyName = dynamic ? (source.company || cap(job.companyName, 300)) : source.company;
  if (!companyName || (source.company && !sameCompany(job.companyName, source))) return skip("employerMismatch");
  if (!location && (!allowUnknown || clearlyForeign(evidence))) return skip("noSaudiEvidence");
  if (!location && diagnostics) diagnostics.geographyUnknown += 1;
  const sourceUrl = secureUrl(job.sourceUrl || page.url);
  if (!sourceUrl || !allowedUrl(sourceUrl, source)) return skip("outOfScopePosting");
  if (diagnostics) diagnostics.relevantPrograms += 1;
  const common = {
    companyName,
    opportunityTitle: title,
    trainingType: type,
    sourceUrl, sourceType, pageTitle,
    evidenceText: cap(body, 4000), evidencePublishedAt: dateValue(job.postedAt),
    deadline: dateValue(job.extractionEvidence?.deadline?.rawText, true) || dateValue(job.deadline, true),
    startDate: dateValue(job.trainingStartDate),
    collectorSource: source.key, searchQuery: query,
    ...location,
  };
  const portal = secureUrl(job.applicationUrl);
  const applicationLinks = [...urls];
  if (portal && !applicationLinks.some((entry) => entry.applicationUrl === portal)) {
    applicationLinks.push({ channelType: channelForUrl(portal), applicationUrl: portal,
      applicationEvidenceText: cap(job.applicationCta?.label || title, 1500) });
  }
  if (dynamic && !applicationLinks.length && recruitingDetail(sourceUrl)) {
    applicationLinks.push({ channelType: channelForUrl(sourceUrl), applicationUrl: sourceUrl });
  }
  const channels = [...emailChannels(body, mailLinks), ...applicationLinks]
    .filter((channel) => !dynamic || !channel.applicationUrl || publicSearchUrl(channel.applicationUrl));
  if (!channels.length) return skip("noChannel");
  return channels.map((channel) => {
    const shared = channel.applicationUrl && SHARED_PORTAL.test(new URL(channel.applicationUrl).pathname) &&
      !new URL(channel.applicationUrl).searchParams.size;
    if (!shared) return { ...common, ...channel };
    const opportunityId = createHash("sha256").update(JSON.stringify([cleanOpportunityUrl(sourceUrl), title])).digest("hex");
    return { ...common, ...channel, opportunityId, sharedApplicationUrl: true };
  });
}

function extractPage(page, source, { jobs, query, diagnostics, allowUnknown = false } = {}) {
  const $ = cheerio.load(page.text);
  const pageTitle = cap($("title").first().text(), 500);
  const candidates = jobs?.length ? jobs : structuredJobs(page.text, page.url, source);
  const siteName = cap($("meta[property='og:site_name']").attr("content"), 240);
  $("nav,footer,header,aside,script,style,noscript").remove();
  const root = $("main,article,[role=main]").first();
  const content = root.length ? root : $("body");
  const visibleText = text(content.html());
  const title = content.find("h1").first().text().trim() || pageTitle;
  const htmlLinks = linkedChannels($, content, page.url);
  const path = new URL(page.url).pathname;
  let sourceType = "official_company_website";
  if (source.sourceType === "untrusted_search_page") sourceType = "dynamic_search_page";
  else if (source.sourceType === "ats" || ATS_HOST.test(new URL(page.url).hostname)) sourceType = "public_ats_job_page";
  else if (source.sourceType === "university" || /\/(?:news|announcements?)(?:\/|$)/i.test(path)) sourceType = "official_announcement";
  else if (candidates.length) sourceType = "official_job_program_page";
  else if (/careers?|recruitment|jobs?/.test(path)) sourceType = "official_careers_page";

  if (candidates.length) {
    return candidates.slice(0, 30).flatMap((job) => {
      const sameDetail = candidates.length === 1 && allowedUrl(page.url, source) &&
        (job.sourceUrl === page.url || String(job.title || "").trim() === title.trim());
      const body = job.rawContent || job.description || "";
      return opportunityChannels(job, page, source, {
        body: sameDetail && visibleText && !body.includes(visibleText) ? [body, visibleText].filter(Boolean).join("\n") : body,
        urls: sameDetail ? htmlLinks.urls : [], mailLinks: sameDetail ? htmlLinks.mailLinks : [],
        pageTitle, query, sourceType, diagnostics, allowUnknown,
      });
    });
  }

  if (!TRAINING.test(title) && !GRADUATE.test(title) && !UNIVERSITY.test(title)) {
    if (diagnostics) diagnostics.noProgram += 1;
    return [];
  }
  const labeledDeadline = visibleText.match(/(?:application deadline|closing date|آخر موعد للتقديم|الموعد النهائي للتقديم)\s*[:：]?\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
  const timeField = (itemprop) => content.find(`time[itemprop="${itemprop}"]`).first().attr("datetime");
  return opportunityChannels({
    title, deadline: timeField("validThrough") || labeledDeadline,
    companyName: source.sourceType === "untrusted_search_page" && !source.company &&
      !/^(?:careers?|jobs?|recruitment|home)$/i.test(siteName) ? siteName : "",
    postedAt: timeField("datePosted") || $("meta[property='article:published_time']").attr("content"),
    trainingStartDate: timeField("jobStartDate"),
  }, page, source, { body: visibleText, ...htmlLinks, pageTitle, query, sourceType, diagnostics, allowUnknown });
}

function extractSearchLead(result, source, { allowUnknown = false } = {}) {
  const sourceUrl = allowUnknown ? publicSearchUrl(result.url) : secureUrl(result.url);
  const title = cap(result.title, 300);
  const evidence = cap(result.description, 2000);
  const location = sourceUrl && geography({}, title + "\n" + evidence, sourceUrl);
  if (!sourceUrl || (allowUnknown ? (!source.company || !relevantSearchResult(result) ||
    clearlyForeign(title + "\n" + evidence) || evidence.length < 30) :
    (!location || !LEAD_TRAINING.test(title) || !APPLY.test(evidence)))) return [];
  const type = programType(title, title + "\n" + evidence);
  const channels = !allowUnknown || APPLY.test(evidence) ? emailChannels(evidence) : [];
  const kind = channelForUrl(sourceUrl);
  if (kind === "EXTERNAL_FORM" || (allowUnknown ? recruitingDetail(sourceUrl) : ATS_HOST.test(new URL(sourceUrl).hostname))) {
    channels.push({ channelType: kind, applicationUrl: sourceUrl,
      ...(APPLY.test(evidence) ? { applicationEvidenceText: evidence.slice(0, 1500) } : {}) });
  }
  return channels.map((channel) => ({ companyName: source.company, opportunityTitle: title, trainingType: type || "",
    sourceUrl, sourceType: "search_engine_discovery", evidenceText: evidence, pageTitle: title,
    collectorSource: source.key, searchQuery: result.query, ...location, ...channel }));
}

module.exports = { extractPage, extractSearchLead, channelForUrl, secureUrl, programType, geography };

const cheerio = require("cheerio");
const { normalize, cleanOpportunityUrl } = require("../opportunityCandidateData");
const { allowedUrl } = require("./http");

const TRAINING = /\b(co[ -]?op|cooperative training|intern(?:ship)?s?|summer training|industrial training|professional training for students|student program(?:me)?|university program(?:me)?|trainees?|graduate program(?:me)?)\b|تدريب تعاوني|التدريب التعاوني|تدريب صيفي|التدريب الصيفي|تدريب طلاب|فرصة تدريب|برنامج جامعي|متدرب|برنامج.{0,15}(طلاب|الطلبة|الخريجين)/i;
const AUDIENCE = /\b(student|undergraduate|university|college|graduate|internship|cooperative|enrolled|practical training|mentorship)\b|طلاب|طلبة|جامع|خريج|متطلب.{0,12}تخرج|تدريب عملي/i;
const CLOSED = /applications? (?:are )?closed|no longer accepting|no longer available|position (?:has been )?filled|job (?:has )?expired|التقديم مغلق|انتهى التقديم|انتهت فترة|التسجيل مغلق/i;
const POOL = /talent (?:community|pool)|expression of interest|future opportunities|once we start the recruitment|مجتمع المواهب|إبداء الاهتمام/i;
const APPLY = /^(apply(?: now| for this (?:job|position))?|submit application|تقدم الآن|قدم الآن|تقديم الطلب|التقديم الآن|التقديم|تقديم)$/i;
const SECTION = {
  responsibilities: /^(?:key |main |job )?(?:responsibilities|duties|what you(?:'|’)ll do|your role|المهام|المسؤوليات|المهام والمسؤوليات)$/i,
  requirements: /^(?:(?:minimum|essential|preferred|job) )?(?:requirements|qualifications|eligibility|selection criteria|who (?:we are targeting|can apply)|الشروط|شروط القبول|شروط التقديم|المتطلبات|المؤهلات)$/i,
  majors: /^(?:targeted majors|majors|fields of study|التخصصات|التخصصات المستهدفة|التخصصات المطلوبة)$/i,
};
function text(html) {
  const $ = cheerio.load(String(html || "")); $("script,style,noscript,nav,footer").remove();
  $("br").replaceWith("\n"); $("p,li,h1,h2,h3,h4,div").append("\n");
  return $.root().text().replace(/[\t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
function sections(html) {
  const $ = cheerio.load(html || ""); const result = { responsibilities: [], requirements: [], majors: [] }; let current = null;
  $("h1,h2,h3,h4,h5,h6,p,li").each((_, el) => {
    const node = $(el), value = node.text().replace(/\s+/g, " ").trim();
    const label = value.replace(/[:：]+$/, "").trim();
    const key = Object.keys(SECTION).find((k) => SECTION[k].test(label));
    if (key) { current = key; return; }
    if (/^h\d$/.test(el.tagName)) { current = null; return; }
    if (current && value && !node.find("li,p").length) result[current].push(value.slice(0, 2000));
  });
  for (const key of Object.keys(result)) result[key] = [...new Set(result[key])].slice(0, 80);
  return result;
}
function isoDate(value) {
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value).toISOString() : null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value.trim())) return null;
  const date = new Date(value); if (Number.isNaN(date.getTime())) return null;
  if (!value.includes("T") && date.toISOString().slice(0, 10) !== value) return null;
  return date.toISOString();
}
function linkedUrl(value, base, source) {
  try { const url = cleanOpportunityUrl(new URL(value, base).href); return allowedUrl(url, source) ? url : ""; } catch { return ""; }
}
function emails(content, sourceUrl) {
  const values = String(content).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  return [...new Set(values.map((v) => v.toLowerCase()))].flatMap((email) => {
    const local = email.split("@")[0];
    const type = /coop|co-op/.test(local) ? "coop" : /training|internship/.test(local) ? "training" :
      /careers/.test(local) ? "careers" : /recruitment|recruiting/.test(local) ? "recruitment" : /^hr(?:[._-]|$)/.test(local) ? "hr" : null;
    return type ? [{ email, type, sourceUrl, confidence: 90 }] : [];
  }).slice(0, 30);
}
function trainingType(title, body) {
  const namedSummerProgram = /\bsummer\b|صيف/i.test(title) && /internship|تدريب/i.test(body) && /student|undergraduate|طلاب|جامع/i.test(body);
  if ((!TRAINING.test(title) && !namedSummerProgram) || !AUDIENCE.test(body)) return null;
  if (/\b(?:manager|director|head of|senior|trainer)\b|مدير|رئيس|مدرب/i.test(title)) return null;
  if (/co[ -]?op|cooperative|تعاوني/i.test(title)) return "coop";
  if (/summer|صيفي/i.test(title)) return "summer";
  if (/graduate|خريج/i.test(title)) return "graduate";
  return "internship";
}
function jobFromHtml(html, url, source, overrides = {}) {
  const $ = cheerio.load(html); const policy = source.metadata.selectors || {};
  $("nav,footer,script,style,noscript").remove();
  const root = $(policy.content || "main,article,[role=main]").first();
  const content = root.length ? root : $("body");
  const body = text(content.html());
  const title = (overrides.title || content.find(policy.title || "h1").first().text()).trim();
  const application = content.find("a[href]").toArray().find((el) => APPLY.test($(el).text().trim()) && !$(el).is("[aria-disabled=true],.disabled"));
  const applicationUrl = application ? linkedUrl($(application).attr("href"), url, source) : "";
  return { title, description: body, rawContent: body, ...sections(content.html()), sourceUrl: url,
    applicationUrl, applyVisible: Boolean(applicationUrl), actualPosting: false, ...overrides };
}
function structuredJobs(html, url, source) {
  const $ = cheerio.load(html), nodes = [];
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    if ([value["@type"]].flat().includes("JobPosting")) nodes.push(value);
    if (value["@graph"]) visit(value["@graph"]);
    if (value.itemListElement) visit(value.itemListElement);
    if (value.item) visit(value.item);
  }
  $("script[type='application/ld+json']").each((_, el) => { try { visit(JSON.parse($(el).text())); } catch { /* Invalid structured data is not evidence. */ } });
  return nodes.slice(0, 40).map((job) => {
    const description = text(job.description), extracted = sections(job.description);
    const locations = [job.jobLocation].flat().filter(Boolean).map((v) => v.address || {});
    const page = jobFromHtml(html, url, source);
    const link = linkedUrl(job.url || url, url, source);
    const samePage = nodes.length === 1 && (!link || new URL(link).pathname === new URL(url).pathname);
    const stringList = (value) => [value].flat().filter((v) => typeof v === "string").map(text).filter(Boolean);
    return { ...extracted, title: job.title || "", description, rawContent: description,
      companyName: typeof job.hiringOrganization?.name === "string" ? job.hiringOrganization.name : "",
      companyLogo: typeof job.hiringOrganization?.logo === "string" ? job.hiringOrganization.logo : "",
      cities: locations.map((v) => v.addressLocality).filter((v) => typeof v === "string"),
      countries: locations.map((v) => typeof v.addressCountry === "string" ? v.addressCountry : v.addressCountry?.name).filter(Boolean),
      remote: job.jobLocationType === "TELECOMMUTE", postedAt: isoDate(job.datePosted), deadline: isoDate(job.validThrough), trainingStartDate: isoDate(job.jobStartDate),
      responsibilities: job.responsibilities ? stringList(job.responsibilities) : extracted.responsibilities,
      requirements: job.qualifications ? stringList(job.qualifications) : extracted.requirements,
      sourceUrl: link || url, applicationUrl: (samePage && page.applicationUrl) || link, actualPosting: true,
      applyVisible: samePage && page.applyVisible, closed: (samePage && CLOSED.test(page.description)) || CLOSED.test(description),
    };
  });
}
function discoverLinks(html, url, source) {
  const $ = cheerio.load(html), links = [];
  $("a[href]").each((_, el) => {
    const label = $(el).text().trim(), href = $(el).attr("href");
    if (!TRAINING.test(label) && !/coop|internship|trainee/i.test(href)) return;
    const clean = linkedUrl(href, url, source);
    if (clean && !/\.(pdf|jpg|png|zip)(?:\?|$)/i.test(clean)) links.push(clean);
  });
  return [...new Set(links)];
}
function sameCompany(name, source) {
  return !name || [source.company, ...source.metadata.aliases].some((alias) => normalize(alias) === normalize(name));
}
module.exports = { TRAINING, AUDIENCE, CLOSED, POOL, text, sections, isoDate, linkedUrl, emails, trainingType,
  jobFromHtml, structuredJobs, discoverLinks, sameCompany };

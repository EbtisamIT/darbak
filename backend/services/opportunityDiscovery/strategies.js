const cheerio = require("cheerio");
const { TRAINING, CLOSED, text, sections, isoDate, linkedUrl, jobFromHtml, structuredJobs } = require("./extract");
const { verifyJob } = require("./verification");
const { allowedUrl } = require("./http");

function htmlLinks(html, url) {
  const $ = cheerio.load(html), links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href"), label = $(el).text();
    if (!TRAINING.test(label) && !/coop|intern|trainee|student|summer|\/job\//i.test(href)) return;
    try { links.push({ url: new URL(href, url).href, via: "page_link" }); } catch { /* Not a URL. */ }
  });
  // Lists of JobPosting records expose canonical detail URLs before extraction.
  $("script[type='application/ld+json']").each((_, el) => {
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      if ([node["@type"]].flat().includes("JobPosting") && typeof node.url === "string") {
        try { links.push({ url: new URL(node.url, url).href, via: "structured_data" }); } catch { /* Invalid URL. */ }
      }
      for (const key of ["@graph", "itemListElement", "item"]) visit(node[key]);
    }
    try { visit(JSON.parse($(el).text())); } catch { /* Extraction reports missing job content. */ }
  });
  return links.slice(0, 100);
}
const htmlAdapter = {
  async discoverJobs(source, reader) {
    const page = await reader.read(source.sourceUrl);
    return { urls: [{ url: source.sourceUrl, via: "registry" }, ...htmlLinks(page.text, page.url)], pages: [page], warnings: [] };
  },
  async extractJob(reference, source, reader) {
    const page = await reader.read(reference.url);
    let jobs = structuredJobs(page.text, page.url, source), method = jobs.length ? "structured_data" : "http";
    if (!jobs.length) {
      const $ = cheerio.load(page.text);
      if (/\/job(?:-invite)?\//.test(new URL(page.url).pathname) && $(".jobDisplayShell,#job-title").length && CLOSED.test(text($(".jobDisplayShell").html() || page.text))) {
        return { jobs: [], page, fetchMethod: "http", reason: "CLOSED" };
      }
      const detail = $(".jobdescription,[itemprop=description]").first();
      if (/\/job(?:-invite)?\//.test(new URL(page.url).pathname) && detail.length) {
        jobs = [{ ...jobFromHtml(page.text, page.url, source), description: text(detail.html()), rawContent: text(detail.html()),
          ...sections(detail.html(), true), actualPosting: true }]; method = "http";
      } else if (source.metadata.selectors?.detail && $(source.metadata.selectors.detail).length) {
        jobs = [{ ...jobFromHtml(page.text, page.url, source), actualPosting: true }]; method = "http";
      }
    }
    const dynamic = !jobs.length && /<script/i.test(page.text) && (text(page.text).length < 300 || /enable javascript|javascript is required|id=["'](?:root|app)["'][^>]*>\s*<\//i.test(page.text));
    return { jobs, page, fetchMethod: page.fetchMethod === "browser" ? "browser" : method,
      reason: jobs.length ? "" : dynamic ? "DYNAMIC_PAGE" : "NO_JOB_CONTENT" };
  }, verifyJob,
};
function apiUrl(source) { return source.atsIdentifiers?.apiUrl || source.sourceUrl; }
function knownReference(reference, source, kind) {
  if (reference.apiUrl || !source.atsIdentifiers?.apiUrl) return reference;
  const u = new URL(reference.url), base = source.atsIdentifiers.apiUrl;
  if (u.origin === new URL(base).origin && u.pathname.startsWith(`${new URL(base).pathname}/`)) return { ...reference, apiUrl: u.href };
  let id;
  if (kind === "greenhouse") id = u.searchParams.get("gh_jid") || u.pathname.match(/\/jobs\/(\d+)\/?$/)?.[1];
  if (kind === "lever") id = u.pathname.match(/\/([a-f0-9-]{32,36})(?:\/apply)?\/?$/i)?.[1];
  if (kind === "smartrecruiters") id = u.pathname.match(/\/(\d{8,})(?:-[^/]*)?\/?$/)?.[1];
  return id ? { ...reference, apiUrl: `${detailUrl(base, id)}${kind === "lever" ? "?mode=json" : ""}` } : reference;
}
function detailUrl(base, id) { const u = new URL(base); u.pathname = `${u.pathname.replace(/\/$/, "")}/${encodeURIComponent(id)}`; return u.href; }
function decode(html) { const decoded = cheerio.load(html || "").root().text(); return /<\w/.test(decoded) ? decoded : html || ""; }
function parse(page) { try { return JSON.parse(page.text); } catch { throw new Error("PARSER_FAILED"); } }
function apiAdapter(kind) {
  return {
    async discoverJobs(source, reader) {
      const base = apiUrl(source), page = await reader.read(base), data = parse(page);
      const rows = kind === "greenhouse" ? data.jobs : kind === "lever" ? data : data.content;
      if (!Array.isArray(rows)) throw new Error("PARSER_FAILED");
      const eligible = rows.filter((row) => (kind !== "greenhouse" || row.internal_job_id) &&
        (TRAINING.test(row.title || row.text || row.name || "") || /summer|صيف/i.test(row.title || row.text || row.name || "")));
      const urls = eligible.slice(0, 30).map((row) => ({ url: kind === "greenhouse" ? row.absolute_url : kind === "lever" ? row.hostedUrl : row.ref || detailUrl(base, row.id),
        apiUrl: kind === "lever" ? `${detailUrl(base, row.id)}?mode=json` : detailUrl(base, row.id), via: "ats_api" }));
      return { urls, pages: [page], warnings: (data.totalFound > rows.length || rows.length >= 100) ? ["ATS_PAGE_LIMIT_REACHED"] : [] };
    },
    async extractJob(reference, source, reader) {
      // An approved company-owned mirror should use its own structured HTML,
      // rather than deriving a different ATS API request from its numeric URL.
      if (!reference.apiUrl) {
        const referenceHost = new URL(reference.url).hostname;
        const providerHost = { greenhouse: /(?:^|\.)greenhouse\.io$/, lever: /(?:^|\.)lever\.co$/, smartrecruiters: /(?:^|\.)smartrecruiters\.com$/ }[kind];
        if (!providerHost.test(referenceHost) && new URL(reference.url).origin !== new URL(apiUrl(source)).origin) {
          return htmlAdapter.extractJob(reference, source, reader);
        }
      }
      reference = knownReference(reference, source, kind);
      // API identifiers are derived from tenant listings, never from untrusted result metadata.
      if (!reference.apiUrl) return htmlAdapter.extractJob(reference, source, reader);
      if (!allowedUrl(reference.apiUrl, source)) throw new Error("UNAPPROVED_URL_SCOPE");
      const page = await reader.read(reference.apiUrl), row = parse(page);
      let html, job;
      if (kind === "greenhouse") {
        if (!row.title || row.internal_job_id === null) throw new Error("NO_JOB_CONTENT");
        html = decode(row.content);
        job = { title: row.title, companyName: row.company_name || "", cities: row.location?.name ? [row.location.name] : [],
          applicationUrl: linkedUrl(row.absolute_url, page.url, source), sourceUrl: linkedUrl(row.absolute_url, page.url, source),
          postedAt: isoDate(row.first_published), deadline: isoDate(row.application_deadline) };
      } else if (kind === "lever") {
        if (!row.text) throw new Error("NO_JOB_CONTENT");
        html = `${row.description || ""}${(row.lists || []).map((list) => `<h2>${list.text}</h2>${list.content}`).join("")}`;
        job = { title: row.text, cities: row.categories?.location ? [row.categories.location] : [], remote: row.workplaceType === "remote",
          applicationUrl: linkedUrl(row.applyUrl, page.url, source), sourceUrl: linkedUrl(row.hostedUrl, page.url, source), postedAt: isoDate(row.createdAt) };
      } else {
        if (!row.name || !row.jobAd?.sections) throw new Error("NO_JOB_CONTENT");
        const parts = row.jobAd.sections;
        html = Object.values(parts).map((part) => part.text || "").join("\n");
        job = { title: row.name, companyName: row.company?.name || "", cities: row.location?.city ? [row.location.city] : [],
          countries: row.location?.country ? [row.location.country] : [], remote: row.location?.remote === true,
          description: text(parts.jobDescription?.text), responsibilities: sections(parts.jobDescription?.text).responsibilities,
          requirements: text(parts.qualifications?.text) ? [text(parts.qualifications.text)] : [],
          applicationUrl: linkedUrl(row.applyUrl, page.url, source), sourceUrl: linkedUrl(row.postingUrl || reference.url, page.url, source), postedAt: isoDate(row.releasedDate) };
      }
      const extractionEvidence = { ...sections(html, true).extractionEvidence };
      for (const key of ["title", "cities", "postedAt", "deadline", "applicationUrl", "requirements"]) {
        if (job[key]?.length) extractionEvidence[key] = { sourceUrl: page.url, method: "ats_api", rawText: String(job[key]).slice(0, 6000) };
      }
      for (const entry of Object.values(extractionEvidence)) entry.sourceUrl ||= page.url;
      return { jobs: [{ ...sections(html), description: text(html), rawContent: text(html), ...job, extractionEvidence, actualPosting: true, applyVisible: true }], page, fetchMethod: "ats_api", reason: "" };
    }, verifyJob,
  };
}
// Teamtailor's public company pages expose JSON-LD and in-page Apply buttons.
// Both are parsed by the shared HTML implementation without a private API.
const teamtailorAdapter = { ...htmlAdapter };
const strategies = { generic: htmlAdapter, teamtailor: teamtailorAdapter, successfactors: htmlAdapter, workday: htmlAdapter, oracle: htmlAdapter,
  greenhouse: apiAdapter("greenhouse"), lever: apiAdapter("lever"), smartrecruiters: apiAdapter("smartrecruiters") };
function strategyFor(source) { const adapter = strategies[source.atsProvider || source.metadata.adapter]; if (!adapter) throw new Error("PARSER_FAILED"); return adapter; }
module.exports = { strategies, strategyFor, htmlLinks, htmlAdapter, teamtailorAdapter };

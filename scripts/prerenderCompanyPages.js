const fs = require("fs");
const path = require("path");

const apiBase = (process.env.COMPANY_SEO_API_URL || process.env.REACT_APP_API_URL || "https://darbak-api.onrender.com").replace(/\/$/, "");
const buildDir = path.join(__dirname, "..", "build");
const escapeHtml = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
const requestJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// index.html formats some tags over several lines, so match across whitespace.
const replaceTag = (html, tag, attribute, value, replacement) => {
  const pattern = new RegExp(`<${tag}\\s+${attribute}="${escapeRegExp(value)}"[^>]*>`, "i");
  if (!pattern.test(html)) throw new Error(`index.html is missing <${tag} ${attribute}="${value}">`);
  return html.replace(pattern, () => replacement);
};
const inject = (template, { title, description, canonical, structuredData, body }) => {
  const fullTitle = escapeHtml(`${title} | منصة دربك`);
  const safeDescription = escapeHtml(description);
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${fullTitle}</title>`);
  html = replaceTag(html, "meta", "name", "description", `<meta name="description" content="${safeDescription}" />`);
  html = replaceTag(html, "link", "rel", "canonical", `<link rel="canonical" href="${canonical}" />`);
  html = replaceTag(html, "meta", "property", "og:title", `<meta property="og:title" content="${fullTitle}" />`);
  html = replaceTag(html, "meta", "property", "og:description", `<meta property="og:description" content="${safeDescription}" />`);
  html = replaceTag(html, "meta", "property", "og:url", `<meta property="og:url" content="${canonical}" />`);
  html = replaceTag(html, "meta", "name", "twitter:title", `<meta name="twitter:title" content="${fullTitle}" />`);
  html = replaceTag(html, "meta", "name", "twitter:description", `<meta name="twitter:description" content="${safeDescription}" />`);
  return html
    .replace("</head>", () => `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script></head>`)
    // Function replacements keep "$" in user content from being read as a pattern.
    .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
};

let toCanonicalPath = (value) => value;

const TRAINING_MODE_LABELS = { onsite: "حضوري", remote: "عن بعد", hybrid: "هجين" };
const ENVIRONMENT_LABELS = { women: "بيئة نسائية", men: "بيئة رجالية", mixed: "بيئة مختلطة" };

// Only fields already returned by the public experiences list are used here;
// the full experience text stays behind the access gate.
const experienceBody = (experience, seo, major) => {
  const facts = [
    ["الجهة", experience.organizationName],
    ["المدينة", experience.city],
    ["التخصص", major],
    ["مدة التدريب", experience.duration],
    ["سنة التدريب", experience.trainingYear],
    ["طريقة التدريب", TRAINING_MODE_LABELS[experience.trainingMode]],
    ["بيئة التدريب", ENVIRONMENT_LABELS[experience.trainingEnvironment]],
    ["طريقة التقديم", experience.howApplied],
    ["المكافأة", experience.hadReward === "yes" ? "يوجد مكافأة" : experience.hadReward === "no" ? "بدون مكافأة" : ""],
    ["التقييم", Number(experience.starRating) ? `${Number(experience.starRating)} من 5` : ""],
    ["ينصح بالجهة", experience.wouldRecommend === "yes" ? "نعم" : experience.wouldRecommend === "no" ? "لا" : ""],
  ].filter(([, value]) => value && String(value).trim());
  return `<main dir="rtl"><nav><a href="/">دربك</a> <a href="/experiences">تجارب التدريب</a></nav><h1>${escapeHtml(seo.title)}</h1><p>${escapeHtml(seo.description)}</p><ul>${facts.map(([label, value]) => `<li>${escapeHtml(label)}: ${escapeHtml(value)}</li>`).join("")}</ul><p><a href="${toCanonicalPath(seo.path)}">اقرأ التجربة كاملة في دربك</a></p><p><a href="/add-experience">شارك تجربة تدريبك</a></p></main>`;
};

const fetchAllExperiences = async () => {
  const experiences = [];
  for (let page = 1; page <= 200; page += 1) {
    const response = await requestJson(`${apiBase}/api/experiences?page=${page}&limit=60`);
    experiences.push(...(response.data || []));
    if (!response.hasMore || !(response.data || []).length) break;
  }
  return experiences;
};

const sitemapXml = (entries) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((entry) => `  <url><loc>${escapeHtml(encodeURI(entry.loc))}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
const toLastmod = (value) => (value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 10) : "");

const companyBody = (company, data = {}, getCompanySeo) => {
  const seo = getCompanySeo(company, data.overview || {});
  const links = [
    ...(data.experiences || []).slice(0, 3).map((item) => `<li><a href="${toCanonicalPath(`/experiences/${item._id || item.id}`)}">${escapeHtml(item.title || `تجربة تدريب في ${seo.name}`)}</a></li>`),
    ...(data.opportunities || []).filter((item) => item.status === "active").slice(0, 3).map((item) => `<li><a href="/where-to-train/opportunity/${item._id || item.id}">${escapeHtml(item.title || "فرصة تدريب")}</a></li>`),
  ];
  return `<main dir="rtl"><nav><a href="/">دربك</a> <a href="/companies">الشركات</a></nav><h1>التدريب في ${escapeHtml(seo.name)}</h1><p>${escapeHtml(seo.description)}</p><h2>أحدث المحتوى المرتبط بـ ${escapeHtml(seo.name)}</h2>${links.length ? `<ul>${links.join("")}</ul>` : "<p>لا توجد تجارب أو فرص منشورة حاليًا لهذه الجهة.</p>"}<p><a href="${toCanonicalPath(seo.path)}">عرض صفحة ${escapeHtml(seo.name)} في دربك</a></p></main>`;
};

(async () => {
  const { getCompanySeo, buildCompanyStructuredData } = await import("../src/utils/companySeoData.mjs");
  const seoPages = await import("../src/utils/seoPages.mjs");
  toCanonicalPath = seoPages.toCanonicalPath;
  const { toCanonicalUrl, buildExperienceSeo, getExperienceMajor } = seoPages;
  if (!fs.existsSync(path.join(buildDir, "index.html"))) throw new Error("Build output is missing before company prerendering.");
  const template = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
  const companies = (await requestJson(`${apiBase}/api/companies`)).data || [];
  if (!companies.length) throw new Error("No published companies returned; refusing to generate empty SEO pages.");
  const routes = [];
  const sitemapEntries = [{ loc: "https://darbak.space/companies" }];
  for (const company of companies) {
    const response = await requestJson(`${apiBase}/api/companies/${encodeURIComponent(company.slug)}/content`);
    const seo = getCompanySeo(response.company, response.data?.overview || {});
    const html = inject(template, { title: seo.title, description: seo.description, canonical: toCanonicalUrl(seo.path), structuredData: buildCompanyStructuredData(response.company, response.data?.overview || {}), body: companyBody(response.company, response.data, getCompanySeo) });
    const output = path.join(buildDir, "companies", company.slug, "index.html");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, html);
    routes.push(seo.path);
    sitemapEntries.push({ loc: toCanonicalUrl(seo.path), lastmod: toLastmod(response.company?.updatedAt || company.updatedAt) });
  }
  const directoryHtml = inject(template, { title: "جهات التدريب في السعودية | تجارب وفرص ومقابلات", description: "تصفح الجهات التي يشارك عنها الطلاب تجارب التدريب والمقابلات والفرص في دربك.", canonical: "https://darbak.space/companies", structuredData: { "@context": "https://schema.org", "@type": "CollectionPage", name: "جهات التدريب في دربك" }, body: `<main dir="rtl"><h1>استكشف جهات التدريب في دربك</h1><p>تصفح الجهات التي يشارك عنها الطلاب تجارب التدريب والمقابلات والفرص في دربك.</p><ul>${companies.map((company) => `<li><a href="${toCanonicalPath(`/companies/${company.slug}`)}">${escapeHtml(company.name)}</a></li>`).join("")}</ul></main>` });
  fs.mkdirSync(path.join(buildDir, "companies"), { recursive: true });
  fs.writeFileSync(path.join(buildDir, "companies", "index.html"), directoryHtml);
  fs.writeFileSync(path.join(buildDir, "companies", "prerender-routes.json"), JSON.stringify(routes, null, 2));
  console.log(`Prerendered ${routes.length} published company pages.`);

  const experiences = await fetchAllExperiences();
  if (!experiences.length) throw new Error("No approved experiences returned; refusing to generate empty SEO pages.");
  let experiencePages = 0;
  for (const experience of experiences) {
    const id = String(experience._id || experience.id || "");
    if (!/^[a-f0-9]{24}$/i.test(id)) continue;
    const seo = buildExperienceSeo(experience);
    const canonical = toCanonicalUrl(seo.path);
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "دربك", item: "https://darbak.space/" },
        { "@type": "ListItem", position: 2, name: "تجارب التدريب", item: "https://darbak.space/experiences" },
        { "@type": "ListItem", position: 3, name: seo.title, item: canonical },
      ],
    };
    const html = inject(template, { title: seo.title, description: seo.description, canonical, structuredData, body: experienceBody(experience, seo, getExperienceMajor(experience)) });
    const output = path.join(buildDir, "experiences", id, "index.html");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, html);
    sitemapEntries.push({ loc: canonical, lastmod: toLastmod(experience.updatedAt || experience.createdAt) });
    experiencePages += 1;
  }
  // build/experiences/ is now a folder; keep /experiences/ serving the normal app shell.
  fs.writeFileSync(path.join(buildDir, "experiences", "index.html"), template);
  fs.writeFileSync(path.join(buildDir, "sitemap-pages.xml"), sitemapXml(sitemapEntries));
  console.log(`Prerendered ${experiencePages} experience pages; sitemap-pages.xml has ${sitemapEntries.length} URLs.`);
})().catch((error) => { console.error(`SEO prerender failed: ${error.message}`); process.exit(1); });

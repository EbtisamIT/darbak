const fs = require("fs");
const path = require("path");
const { getCompanySeo, buildCompanyStructuredData } = require("../src/utils/companySeoData");

const apiBase = (process.env.COMPANY_SEO_API_URL || process.env.REACT_APP_API_URL || "https://darbak-api.onrender.com").replace(/\/$/, "");
const buildDir = path.join(__dirname, "..", "build");
const escapeHtml = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
const requestJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};
const inject = (template, { title, description, canonical, structuredData, body }) => template
  .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)} | منصة دربك</title>`)
  .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
  .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`)
  .replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)} | منصة دربك" />`)
  .replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
  .replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${canonical}" />`)
  .replace("</head>", `<script type="application/ld+json">${JSON.stringify(structuredData)}</script></head>`)
  .replace('<div id="root"></div>', `<div id="root">${body}</div>`);

const companyBody = (company, data = {}) => {
  const seo = getCompanySeo(company, data.overview || {});
  const links = [
    ...(data.experiences || []).slice(0, 3).map((item) => `<li><a href="/experiences/${item._id || item.id}">${escapeHtml(item.title || `تجربة تدريب في ${seo.name}`)}</a></li>`),
    ...(data.opportunities || []).filter((item) => item.status === "active").slice(0, 3).map((item) => `<li><a href="/where-to-train/opportunity/${item._id || item.id}">${escapeHtml(item.title || "فرصة تدريب")}</a></li>`),
  ];
  return `<main dir="rtl"><nav><a href="/">دربك</a> <a href="/companies">الشركات</a></nav><h1>التدريب في ${escapeHtml(seo.name)}</h1><p>${escapeHtml(seo.description)}</p><h2>أحدث المحتوى المرتبط بـ ${escapeHtml(seo.name)}</h2>${links.length ? `<ul>${links.join("")}</ul>` : "<p>لا توجد تجارب أو فرص منشورة حاليًا لهذه الجهة.</p>"}<p><a href="${seo.path}">عرض صفحة ${escapeHtml(seo.name)} في دربك</a></p></main>`;
};

(async () => {
  if (!fs.existsSync(path.join(buildDir, "index.html"))) throw new Error("Build output is missing before company prerendering.");
  const template = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
  const companies = (await requestJson(`${apiBase}/api/companies`)).data || [];
  if (!companies.length) throw new Error("No published companies returned; refusing to generate empty SEO pages.");
  const routes = [];
  for (const company of companies) {
    const response = await requestJson(`${apiBase}/api/companies/${encodeURIComponent(company.slug)}/content`);
    const seo = getCompanySeo(response.company, response.data?.overview || {});
    const html = inject(template, { title: seo.title, description: seo.description, canonical: `https://darbak.space${seo.path}`, structuredData: buildCompanyStructuredData(response.company, response.data?.overview || {}), body: companyBody(response.company, response.data) });
    const output = path.join(buildDir, "companies", company.slug, "index.html");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, html);
    routes.push(seo.path);
  }
  const directoryHtml = inject(template, { title: "جهات التدريب في السعودية | تجارب وفرص ومقابلات", description: "تصفح الجهات التي يشارك عنها الطلاب تجارب التدريب والمقابلات والفرص في دربك.", canonical: "https://darbak.space/companies", structuredData: { "@context": "https://schema.org", "@type": "CollectionPage", name: "جهات التدريب في دربك" }, body: `<main dir="rtl"><h1>استكشف جهات التدريب في دربك</h1><p>تصفح الجهات التي يشارك عنها الطلاب تجارب التدريب والمقابلات والفرص في دربك.</p><ul>${companies.map((company) => `<li><a href="/companies/${company.slug}">${escapeHtml(company.name)}</a></li>`).join("")}</ul></main>` });
  fs.mkdirSync(path.join(buildDir, "companies"), { recursive: true });
  fs.writeFileSync(path.join(buildDir, "companies", "index.html"), directoryHtml);
  fs.writeFileSync(path.join(buildDir, "companies", "prerender-routes.json"), JSON.stringify(routes, null, 2));
  console.log(`Prerendered ${routes.length} published company pages.`);
})().catch((error) => { console.error(`Company SEO prerender failed: ${error.message}`); process.exit(1); });

const { normalize } = require("../opportunityCandidateData");

// Human-reviewed official URLs. Changing an ATS tenant/scope requires code review;
// an arbitrary URL supplied by an admin request is never a discovery source.
const rows = [
  ["stc", "STC", "telecom", "https://careers.stc.com.sa/content/COOP/?locale=en_US", "successfactors", ["STC", "Saudi Telecom Company"], ["https://careers.stc.com.sa/"]],
  ["aramco", "أرامكو السعودية", "energy", "https://www.aramco.com/en/careers/for-saudi-applicants/student-opportunities/university-and-vocational-college-internship-programs", "generic", ["Saudi Aramco", "Aramco", "Saudi Arabian Oil Company"], ["https://www.aramco.com/en/careers/"]],
  ["sabic", "سابك", "industry", "https://www.sabic.com/en/careers", "generic", ["SABIC", "Saudi Basic Industries Corporation"], ["https://www.sabic.com/en/careers"]],
  ["mobily", "موبايلي", "telecom", "https://www.mobily.com.sa/wps/portal/web/careers", "generic", ["Mobily", "Etihad Etisalat"], ["https://www.mobily.com.sa/wps/portal/web/careers", "https://careers.mobily.com.sa/"]],
  ["elm", "علم", "technology", "https://elm.sa/en/recruitment/Pages/join-our-family.aspx", "generic", ["Elm", "Elm Company"], ["https://elm.sa/en/recruitment/", "https://www.elm.sa/en/recruitment/", "https://career.elm.sa/"]],
  ["snb", "البنك الأهلي السعودي", "banking", "https://www.alahli.com/en/pages/about-us/careers/snb-cooperative-training-program", "generic", ["Saudi National Bank", "SNB"], ["https://www.alahli.com/en/pages/about-us/careers/"]],
  ["saudia", "الخطوط السعودية", "aviation", "https://careers.saudia.com/?locale=en_GB", "successfactors", ["Saudia", "Saudi Airlines", "Saudia Group"], ["https://careers.saudia.com/"]],
  ["jarir", "مكتبة جرير", "retail", "https://www.jarir.com/job-opportunities", "generic", ["Jarir", "Jarir Bookstore"], ["https://www.jarir.com/job-opportunities", "https://jobapp.jarir.com/"]],
  ["pwc", "PwC", "consulting", "https://www.pwc.com/m1/en/careers/student-jobs.html", "generic", ["PwC Middle East", "PricewaterhouseCoopers"], ["https://www.pwc.com/m1/en/careers/", "https://careers.pwc.com/"]],
  ["alrajhi", "مصرف الراجحي", "banking", "https://careers.alrajhibank.com.sa/en/page/coop-program/", "generic", ["Al Rajhi Bank", "alrajhi bank"], ["https://careers.alrajhibank.com.sa/"]],
  ["chalhoub", "Chalhoub Group", "retail", "https://careers.chalhoubgroup.com/jobs", "teamtailor", ["Chalhoub", "مجموعة شلهوب"], ["https://careers.chalhoubgroup.com/"]],
];

const SOURCES = rows.map(([key, company, sector, sourceUrl, adapter, aliases, scopes]) => ({
  key, name: `${company} Careers`, company, companyNormalized: normalize(company),
  baseUrl: new URL(sourceUrl).origin, sourceUrl, sourceType: adapter === "successfactors" ? "ats" : "company",
  country: "SA", active: true, trustScore: 100,
  officialDomains: [new URL(sourceUrl).hostname], careerDomains: [...new Set(scopes.map((url) => new URL(url).hostname))],
  atsProvider: adapter, atsIdentifiers: {}, searchQueries: [`${company} cooperative training Saudi Arabia`, `${company} internship Saudi Arabia`],
  reviewStatus: "approved", approvalEvidence: [sourceUrl],
  metadata: { adapter, aliases, scopes, sector, officialReference: sourceUrl, reviewedAt: "2026-09-29", maxRequests: 8, maxPages: 4, maxCandidates: 5 },
}));

module.exports = { SOURCES };

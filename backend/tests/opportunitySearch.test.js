const assert = require("assert");
const {
  parseOpportunitySearchQuery,
  rankOpportunitySearchResults,
} = require("../services/opportunitySearch");

const now = new Date();
const opportunities = [
  {
    _id: "marketing-description",
    title: "برنامج التدريب التعاوني",
    organizationName: "شركة نمو",
    city: "الرياض",
    specialties: ["إدارة الأعمال"],
    majorCategories: ["المالية والإدارية"],
    note: "يشمل العمل مع فريق التسويق الرقمي والحملات.",
    status: "active",
    createdAt: now,
  },
  {
    _id: "marketing-title",
    title: "تدريب تسويق رقمي",
    organizationName: "شركة ثانية",
    city: "جدة",
    specialties: [],
    majorCategories: [],
    note: "فرصة تدريبية.",
    status: "active",
    createdAt: now,
  },
  {
    _id: "accounting-riyadh",
    title: "برنامج الخريجين",
    organizationName: "شركة مالية",
    city: "الرياض",
    specialties: ["المحاسبة"],
    majorCategories: ["المالية والإدارية"],
    note: "فرصة ضمن الإدارة المالية.",
    status: "active",
    createdAt: now,
  },
  {
    _id: "accounting-jeddah",
    title: "برنامج الخريجين",
    organizationName: "شركة مالية أخرى",
    city: "جدة",
    specialties: ["Accounting"],
    majorCategories: [],
    note: "فرصة محاسبة.",
    status: "active",
    createdAt: now,
  },
  {
    _id: "company-program",
    title: "برنامج تدريب تعاوني في تحليل البيانات",
    organizationName: "برنامج شركة منشور",
    city: "الرياض",
    specialties: ["تقنية المعلومات"],
    majorCategories: ["الحاسب والتقنية"],
    note: "يتضمن Data Analysis وInformation Technology.",
    isDarbakApplication: true,
    companyApplicationCampaignId: "program-1",
    status: "active",
    createdAt: now,
  },
];

const marketingArabic = rankOpportunitySearchResults(opportunities, "تدريب تسويق");
assert.ok(marketingArabic.some((item) => item._id === "marketing-description"));
assert.strictEqual(marketingArabic[0]._id, "marketing-title");

const marketingEnglish = rankOpportunitySearchResults(opportunities, "marketing");
assert.ok(marketingEnglish.some((item) => item._id === "marketing-description"));

const accountingRiyadh = rankOpportunitySearchResults(opportunities, "محاسبة الرياض");
assert.strictEqual(accountingRiyadh[0]._id, "accounting-riyadh");

const program = rankOpportunitySearchResults(opportunities, "information technology");
assert.ok(program.some((item) => item._id === "company-program"));

const parsed = parseOpportunitySearchQuery("تدريب تسويق الرياض");
assert.strictEqual(parsed.city, "الرياض");
assert.ok(parsed.terms.includes("marketing"));

const hiddenCompanyPrograms = ["draft", "pending_review", "closed"].map((status) => ({
  ...opportunities.find((item) => item._id === "company-program"),
  _id: `company-program-${status}`,
  status: "draft",
  companyProgramStatus: status,
}));
const searchablePrograms = [...opportunities, ...hiddenCompanyPrograms].filter(
  (item) => item.status === "active" || item.status === "expired"
);
assert.strictEqual(
  searchablePrograms.filter((item) => item.companyProgramStatus).length,
  0
);
assert.strictEqual(
  searchablePrograms.filter((item) => item._id === "company-program").length,
  1
);

console.log("opportunitySearch tests passed");

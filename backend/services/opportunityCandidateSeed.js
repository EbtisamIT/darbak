const Candidate = require("../models/OpportunityCandidate");
const { createOpportunityCandidate } = require("./opportunityCandidates");

async function seedOpportunityCandidates() {
  if (process.env.NODE_ENV !== "development" || process.env.ENABLE_OPPORTUNITY_INBOX_SEED !== "true") {
    const error = new Error("البيانات التجريبية متاحة في بيئة التطوير فقط."); error.status = 403; throw error;
  }
  const existing = await Candidate.find({ isDemo: true }).lean();
  if (existing.length) return existing;
  const base = {
    title: "برنامج تدريب تعاوني تجريبي", company: "جهة تجريبية", sourceType: "company", programType: "coop",
    applicationUrl: "https://example.com/jobs/demo?utm_source=chatgpt&jobId=demo",
    sourceUrl: "https://example.com/jobs/demo", cities: ["الرياض"], majors: ["نظم المعلومات"],
    description: "بيانات تطوير وهمية وليست فرصة منشورة.", confidenceScore: 95,
    verification: { urlWorks: true, officialSource: true, appearsOpen: true, dateVerified: true, companyVerified: true },
    aiNotes: "بيانات تجريبية؛ نتائج التحقق محاكاة فقط. النشر ممنوع.",
  };
  const ready = await createOpportunityCandidate(base, { isDemo: true });
  const review = await createOpportunityCandidate({ ...base, company: "جهة تحتاج مراجعة", applicationUrl: "", verification: {}, confidenceScore: 30 }, { isDemo: true });
  const duplicate = await createOpportunityCandidate(base, { isDemo: true });
  const update = await createOpportunityCandidate({ ...base, company: "جهة التحديث التجريبية" }, { isDemo: true });
  update.status = "update_existing";
  update.demoExistingSnapshot = { organizationName: update.company, title: update.title,
    applicationUrl: update.applicationUrl, sourceUrl: update.sourceUrl, note: "", cities: [], specialties: [], updatedAt: new Date() };
  await update.save();
  const email = await createOpportunityCandidate({ ...base, company: "جهة البريد التجريبية", discoveredEmails: [
    { email: "training@example.com", type: "training", sourceUrl: "https://example.com/contact", confidence: 90 },
  ] }, { isDemo: true });
  return [ready, review, duplicate, update, email];
}
module.exports = { seedOpportunityCandidates };

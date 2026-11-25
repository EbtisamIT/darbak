const coopEmail = {
  _id: "fixture-coop", contentHash: "synthetic-coop-1", verificationStatus: "NEEDS_REVIEW", isActive: true,
  sourceType: "official_careers_page", sourceUrl: "https://example.org/coop", collectorSource: "fixture",
  companyName: "Example Training", pageTitle: "Cooperative Training | Example Training", opportunityTitle: "Cooperative Training",
  channelType: "EMAIL", destinationEmail: "coop@example.org",
  evidenceText: "Cooperative training for university students in Saudi Arabia. Send your COOP training application and CV to coop@example.org.",
  emailEvidenceText: "Send your COOP training application and CV to coop@example.org.",
};
const genericHr = {
  ...coopEmail, _id: "fixture-hr", contentHash: "synthetic-hr-1", destinationEmail: "hr@example.org",
  evidenceText: "Cooperative training for university students in Saudi Arabia. For general recruitment inquiries contact hr@example.org.",
  emailEvidenceText: "For general recruitment inquiries contact hr@example.org.",
};
const arabicPortal = {
  _id: "fixture-portal", contentHash: "synthetic-portal-1", verificationStatus: "NEEDS_REVIEW", isActive: true,
  sourceType: "official_job_program_page", sourceUrl: "https://example.org/training", collectorSource: "fixture",
  companyName: "جهة تدريب اختبارية", opportunityTitle: "برنامج التدريب التعاوني",
  channelType: "COMPANY_PORTAL", applicationUrl: "https://example.org/careers/coop/apply",
  evidenceText: "برنامج التدريب التعاوني لطلاب الجامعات في السعودية. مكان التدريب: الرياض. التخصصات المقبولة: المحاسبة. يجب إرفاق السيرة الذاتية.",
  applicationEvidenceText: "التقديم الآن",
};
module.exports = { coopEmail, genericHr, arabicPortal };

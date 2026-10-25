const express = require("express");
const mongoose = require("mongoose");
const Company = require("../models/Company");
const Opportunity = require("../models/Opportunity");
const OpportunityCandidate = require("../models/OpportunityCandidate");
const OpportunityEmailLead = require("../models/OpportunityEmailLead");
const Experience = require("../models/Experience");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Channel = require("../models/AutoApplyEmailChannel");
const staticRows = require("../data/autoApplyStaticEmailCandidates.json");
const { candidateKey, uniqueCandidates, validateReview, coverage, coverageBreakdown } = require("./autoApplyEmailNetwork");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");

const emailFromUrl = (value) => {
  const text = String(value || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return text;
  const match = text.match(/^mailto:([^?\s,;]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
};

async function inventory() {
  const [companies, opportunities, leads, candidates, reviews] = await Promise.all([
    Company.find({}).select("name city contactEmail _id slug").lean(),
    Opportunity.find({ applicationMethod: "email" }).select("organizationName companyId applicationUrl sourceUrl city cities specialties deadline status _id").lean(),
    OpportunityEmailLead.find({}).select("company email emailType sourceUrl city majors _id").lean(),
    OpportunityCandidate.find({ "discoveredEmails.0": { $exists: true } }).select("company discoveredEmails cities majors _id").lean(),
    Channel.find({}).lean(),
  ]);
  const rows = [
    ...staticRows,
    ...companies.filter((row) => row.contactEmail).map((row) => ({ company: row.name, email: row.contactEmail, companyId: row._id, hqCity: row.city, sourceName: "Company" })),
    ...opportunities.map((row) => ({ company: row.organizationName, email: emailFromUrl(row.applicationUrl), companyId: row.companyId, opportunityId: row._id, sourceUrl: row.sourceUrl, sourceName: "Opportunity" })),
    ...leads.map((row) => ({ company: row.company, email: row.email, emailType: row.emailType, sourceUrl: row.sourceUrl, sourceName: "OpportunityEmailLead" })),
    ...candidates.flatMap((row) => (row.discoveredEmails || []).map((item) => ({ company: row.company, email: item.email, emailType: item.type, sourceUrl: item.sourceUrl, sourceName: "OpportunityCandidate" }))),
    ...reviews.map((row) => ({ company: row.company, email: row.email, companyId: row.companyId, sourceNames: row.sourceNames })),
  ];
  const merged = uniqueCandidates(rows);
  const reviewByKey = new Map(reviews.map((row) => [candidateKey(row.company, row.email), row]));
  const companyById = new Map(companies.map((row) => [String(row._id), row]));
  const companyByName = new Map(companies.map((row) => [normalizeCompanyComparable(row.name), row]));
  for (const candidate of merged) {
    const matchingCompany = companyByName.get(candidate.companyNormalized);
    if (matchingCompany && !candidate.companyId) candidate.companyId = matchingCompany._id;
    if (matchingCompany && !candidate.hqCity) candidate.hqCity = matchingCompany.city || "";
  }

  // Review priority only. These signals never verify an inbox or establish eligibility.
  const since = new Date(Date.now() - 90 * 86400000);
  const [companyTraffic, opportunityTraffic, searchTraffic, experienceCounts] = await Promise.all([
    AnalyticsEvent.aggregate([{ $match: { eventName: "company_page_viewed", createdAt: { $gte: since }, "metadata.companySlug": { $type: "string" } } }, { $group: { _id: "$metadata.companySlug", views: { $sum: 1 } } }]),
    AnalyticsEvent.aggregate([{ $match: { eventName: "opportunity_detail_viewed", createdAt: { $gte: since }, "metadata.opportunityId": { $type: "string" } } }, { $group: { _id: "$metadata.opportunityId", views: { $sum: 1 } } }]),
    AnalyticsEvent.aggregate([{ $match: { eventName: "where_to_train_search", createdAt: { $gte: since }, searchQuery: { $type: "string" } } }, { $group: { _id: "$searchQuery", searches: { $sum: 1 } } }]),
    Experience.aggregate([{ $match: { status: "approved", companyId: { $ne: null } } }, { $group: { _id: "$companyId", count: { $sum: 1 } } }]),
  ]);
  const companyViews = new Map(companyTraffic.map((row) => [row._id, row.views]));
  const opportunityViews = new Map(opportunityTraffic.map((row) => [row._id, row.views]));
  const searchedCompanies = new Map(searchTraffic.map((row) => [normalizeCompanyComparable(row._id), row.searches]));
  const experiences = new Map(experienceCounts.map((row) => [String(row._id), row.count]));
  const data = merged.map((candidate) => {
    const review = reviewByKey.get(candidate.key);
    const company = companyById.get(String(candidate.companyId || ""));
    const score = (candidate.hqCity === "الرياض" ? 1000 : 0)
      + Math.min(200, companyViews.get(company?.slug) || 0)
      + Math.min(120, opportunityViews.get(String(candidate.opportunityId || "")) || 0)
      + Math.min(80, searchedCompanies.get(candidate.companyNormalized) || 0)
      + ((candidate.priorityMajors || []).some((major) => /حساب|معلومات|تقني|بيانات|برمج|ذكاء|سيبران/i.test(major)) ? 40 : 0)
      + ((candidate.priorityMajors || []).some((major) => /محاسب|مالي|تمويل/i.test(major)) ? 30 : 0)
      + (experiences.has(String(candidate.companyId || "")) ? 20 : 0)
      + (candidate.detectedPurpose === "training" ? 10 : candidate.detectedPurpose === "careers" ? 5 : 0);
    return { ...candidate, review: review ? {
      channelType: review.channelType, verificationStatus: review.verificationStatus,
      acceptsTrainingApplications: review.acceptsTrainingApplications, majors: review.majors, allMajors: review.allMajors,
      cities: review.cities, allSaudi: review.allSaudi, remote: review.remote,
      evidenceUrl: review.evidenceUrl, evidenceType: review.evidenceType, evidenceTextSummary: review.evidenceTextSummary,
      evidenceDate: review.evidenceDate, verifiedAt: review.verifiedAt, expiresAt: review.expiresAt,
      reviewerNote: review.reviewerNote, rejectionReason: review.rejectionReason,
      activeOpportunityId: review.activeOpportunityId,
    } : null, priorityScore: score };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.company.localeCompare(b.company, "ar") || a.email.localeCompare(b.email));
  return { data, reviews };
}

function createAutoApplyEmailNetworkRouter() {
  const router = express.Router();
  router.get("/", async (req, res) => {
    try {
      const { data, reviews } = await inventory();
      const page = Math.max(1, Math.min(1000, parseInt(req.query.page, 10) || 1));
      const limit = 20;
      const status = String(req.query.status || "");
      const filtered = status ? data.filter((row) => (row.review?.verificationStatus || row.initialStatus) === status) : data;
      const eligible = reviews.filter((row) => row.verificationStatus === "verified" && row.acceptsTrainingApplications && (!row.expiresAt || new Date(row.expiresAt) >= new Date()));
      const verifiedActive = eligible.filter((row) => row.channelType === "active_opportunity");
      const verifiedEvergreen = eligible.filter((row) => row.channelType === "evergreen_training");
      res.json({ data: filtered.slice((page - 1) * limit, page * limit), page, pages: Math.ceil(filtered.length / limit), total: filtered.length,
        summary: { candidateCompanies: new Set(data.map((row) => row.companyNormalized)).size, candidateEmails: new Set(data.map((row) => row.email)).size,
          candidatePairs: data.length, reviewed: reviews.length, verifiedActive: new Set(verifiedActive.map((row) => String(row.companyId || row.companyNormalized))).size,
          verifiedEvergreen: new Set(verifiedEvergreen.map((row) => String(row.companyId || row.companyNormalized))).size,
          verifiedUniqueCompanies: new Set(eligible.map((row) => String(row.companyId || row.companyNormalized))).size,
          likely: data.filter((row) => (row.review?.verificationStatus || row.initialStatus) === "likely").length,
          unverified: data.filter((row) => (row.review?.verificationStatus || row.initialStatus) === "unverified").length,
          rejected: data.filter((row) => (row.review?.verificationStatus || row.initialStatus) === "rejected").length,
          evidenceOlderThan12Months: reviews.filter((row) => row.evidenceDate && Date.now() - new Date(row.evidenceDate).getTime() > 365 * 86400000).length },
        coverage: { active: coverage(reviews, "active_opportunity"), evergreen: coverage(reviews, "evergreen_training") },
        breakdown: { active: coverageBreakdown(verifiedActive), evergreen: coverageBreakdown(verifiedEvergreen), total: coverageBreakdown(eligible) } });
    } catch (error) { res.status(500).json({ error: "تعذر تحميل مراجعة قنوات البريد." }); }
  });
  router.post("/:key/review", async (req, res) => {
    try {
      const { data } = await inventory();
      const candidate = data.find((row) => row.key === req.params.key);
      if (!candidate) return res.status(404).json({ error: "مرشح البريد غير موجود." });
      const update = validateReview(req.body, candidate);
      if (update.activeOpportunityId && !mongoose.isObjectIdOrHexString(update.activeOpportunityId)) return res.status(400).json({ error: "معرف الفرصة غير صالح." });
      if (update.activeOpportunityId) {
        const opportunity = await Opportunity.findById(update.activeOpportunityId).select("status deadline applicationMethod applicationUrl").lean();
        if (!opportunity || opportunity.status !== "active" || (opportunity.deadline && new Date(opportunity.deadline) < new Date()) ||
          opportunity.applicationMethod !== "email" || emailFromUrl(opportunity.applicationUrl).toLowerCase() !== candidate.email) {
          return res.status(400).json({ error: "الفرصة المرتبطة ليست فرصة بريد نشطة لهذا العنوان." });
        }
      }
      await Channel.findOneAndUpdate({ companyNormalized: candidate.companyNormalized, email: candidate.email },
        { $set: { ...update, company: candidate.company, companyNormalized: candidate.companyNormalized, email: candidate.email,
          companyId: candidate.companyId || null, sourceNames: candidate.sourceNames } }, { upsert: true, new: true, runValidators: true });
      res.json({ saved: true });
    } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ error: error.code === 11000 ? "القناة مسجلة مسبقًا؛ حدّثي القائمة." : error.message }); }
  });
  return router;
}

module.exports = { createAutoApplyEmailNetworkRouter, inventory };

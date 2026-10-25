const crypto = require("node:crypto");
const { normalizeCompanyComparable } = require("./companyDirectorySeeds");

const CHANNEL_TYPES = ["active_opportunity", "evergreen_training", "hr_general", "unknown"];
const VERIFICATION_STATUSES = ["verified", "likely", "unverified", "rejected"];
const EVIDENCE_TYPES = ["official_training_page", "official_careers_page", "official_training_announcement", "repeated_official_training_announcements", "historical_official_training_announcement", "official_social_post", "official_company_reply"];
const BLOCKED_INBOX = /^(info|support|help|contact|contactus|cs|ccc|care|service|customerservice|customer-service|complaints?|procurement|media|press|pr)([._+-].*)?$/i;
const TRAINING_EVIDENCE = new Set(["official_training_page", "official_careers_page", "repeated_official_training_announcements", "official_social_post", "official_company_reply"]);

function normalizeEmail(value) {
  return String(value || "").trim().replace(/^mailto:/i, "").split("?")[0].replace(/[.,;:]+$/, "").trim().toLowerCase();
}

const REJECTION_REASONS = ["support_only", "general_contact_only", "careers_but_no_training_evidence", "personal_employee_email", "expired_opportunity_only", "portal_required", "no_official_evidence"];

function candidateKey(company, email) {
  return crypto.createHash("sha256").update(`${normalizeCompanyComparable(company)}\n${normalizeEmail(email)}`).digest("hex");
}

function blockedInbox(email) {
  return BLOCKED_INBOX.test(normalizeEmail(email).split("@")[0]);
}

function detectedPurpose(email, type = "") {
  const local = normalizeEmail(email).split("@")[0];
  if (blockedInbox(email)) return "general";
  if (/coop|intern|training|تدريب/i.test(`${local} ${type}`)) return "training";
  if (/career|recruit|jobs?/i.test(`${local} ${type}`)) return "careers";
  if (/^hr([._+-]|$)|human.resource/i.test(local) || /موارد بشرية/i.test(type)) return "hr";
  return "unknown";
}
const initialStatus = (purpose) => purpose === "general" ? "rejected" : ["hr", "careers"].includes(purpose) ? "likely" : "unverified";

function validateReview(input, candidate, now = new Date()) {
  if (!input || !CHANNEL_TYPES.includes(input.channelType) || !VERIFICATION_STATUSES.includes(input.verificationStatus)) throw new Error("تصنيف القناة غير صالح.");
  const email = normalizeEmail(candidate.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("البريد غير صالح.");
  const list = (value) => {
    if (!Array.isArray(value) || value.length > 80 || value.some((item) => typeof item !== "string" || item.trim().length > 120)) throw new Error("قائمة التخصصات أو المدن غير صالحة.");
    return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  };
  const date = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error("تاريخ الدليل غير صالح.");
    return parsed;
  };
  const evidenceUrl = String(input.evidenceUrl || "").trim();
  const evidenceTextSummary = String(input.evidenceTextSummary || "").trim();
  const reviewerNote = String(input.reviewerNote || "").trim();
  const rejectionReason = String(input.rejectionReason || "").trim();
  if (evidenceTextSummary.length > 1000) throw new Error("ملخص الدليل طويل جدًا.");
  if (reviewerNote.length > 500 || (rejectionReason && !REJECTION_REASONS.includes(rejectionReason))) throw new Error("سبب المراجعة غير صالح.");
  if (input.verificationStatus === "rejected" && !rejectionReason) throw new Error("حددي سبب الاستبعاد.");
  const evidenceType = input.evidenceType || "";
  if (evidenceType && !EVIDENCE_TYPES.includes(evidenceType)) throw new Error("نوع الدليل غير صالح.");
  if (evidenceUrl) {
    let url;
    try { url = new URL(evidenceUrl); } catch { throw new Error("رابط الدليل غير صالح."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("رابط الدليل غير صالح.");
  }
  const evidenceDate = date(input.evidenceDate);
  let expiresAt = date(input.expiresAt);
  const majors = list(input.majors || []), cities = list(input.cities || []);
  const allMajors = input.allMajors === true, allSaudi = input.allSaudi === true, remote = input.remote === true;
  if (allMajors && majors.length) throw new Error("اختاري جميع التخصصات أو تخصصات محددة.");
  if (allSaudi && cities.length) throw new Error("اختاري جميع المدن أو مدنًا محددة.");
  let acceptsTrainingApplications = false;
  if (input.verificationStatus === "verified") {
    if (blockedInbox(email)) throw new Error("البريد العام أو خدمة العملاء غير صالح للتقديم التلقائي.");
    if (!evidenceUrl || !evidenceTextSummary || !evidenceType || !evidenceDate) throw new Error("توثيق القناة يتطلب رابطًا وملخصًا ونوعًا وتاريخًا للدليل.");
    if (evidenceDate > now) throw new Error("تاريخ الدليل في المستقبل.");
    if (input.channelType === "active_opportunity") {
      if (evidenceType !== "official_training_announcement") throw new Error("القناة النشطة تتطلب إعلان تدريب رسميًا حاليًا.");
      if (expiresAt && expiresAt < now) throw new Error("انتهى الإعلان؛ راجعي صلاحية القناة بدل اعتباره فرصة نشطة.");
      if (!expiresAt && now - evidenceDate > 90 * 86400000) throw new Error("إعلان بلا موعد إغلاق مضى عليه أكثر من 90 يومًا؛ يلزم دليل أحدث.");
    } else if (input.channelType === "evergreen_training") {
      if (!TRAINING_EVIDENCE.has(evidenceType) || (evidenceType === "official_careers_page" && !/تدريب|تعاوني|intern|coop|trainee/i.test(evidenceTextSummary))) throw new Error("الإعلان القديم أو بريد التوظيف وحده لا يثبت قناة تدريب دائمة.");
      if (now - evidenceDate > 366 * 86400000) throw new Error("يحتاج دليل القناة الدائمة إلى إعادة تحقق حديثة.");
      if (!expiresAt) expiresAt = new Date(now.getTime() + 365 * 86400000);
      if (expiresAt < now) throw new Error("انتهت صلاحية التحقق.");
    } else throw new Error("يمكن توثيق قناة تدريب نشطة أو دائمة فقط.");
    acceptsTrainingApplications = true;
  }
  if (allMajors && !/جميع التخصصات|كل التخصصات|all majors|all special/i.test(evidenceTextSummary)) throw new Error("اذكري نص الدليل الذي يثبت شمول جميع التخصصات.");
  if (allSaudi && !/جميع مناطق|كل مناطق|جميع المدن|كل المدن|all saudi|nationwide/i.test(evidenceTextSummary)) throw new Error("اذكري نص الدليل الذي يثبت شمول المدن.");
  return {
    channelType: input.channelType, verificationStatus: input.verificationStatus, acceptsTrainingApplications,
    majors, allMajors, cities, allSaudi, remote, evidenceUrl, evidenceType, evidenceTextSummary,
    evidenceDate, expiresAt, verifiedAt: acceptsTrainingApplications ? now : null, reviewerNote,
    rejectionReason: input.verificationStatus === "rejected" ? rejectionReason : "",
    activeOpportunityId: input.channelType === "active_opportunity" && input.activeOpportunityId ? input.activeOpportunityId : null,
  };
}

function uniqueCandidates(rows) {
  const byKey = new Map();
  for (const row of rows) {
    if (!row?.company || !row?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(row.email))) continue;
    const key = candidateKey(row.company, row.email);
    const previous = byKey.get(key);
    if (!previous) {
      const purpose = detectedPurpose(row.email, row.contactType || row.emailType);
      byKey.set(key, { key, company: row.company, companyNormalized: normalizeCompanyComparable(row.company), email: normalizeEmail(row.email), sourceNames: [...new Set(row.sourceNames || [row.sourceName].filter(Boolean))], evidenceUrls: row.sourceUrl ? [row.sourceUrl] : [], sourceHints: [row.usage, row.note].filter(Boolean), detectedPurpose: purpose, initialStatus: initialStatus(purpose), companyId: row.companyId || null, hqCity: row.hqCity || "", priorityMajors: row.claimedMajors || [], opportunityId: row.opportunityId || null });
    }
    else {
      previous.sourceNames = [...new Set([...previous.sourceNames, ...(row.sourceNames || [row.sourceName].filter(Boolean))])];
      if (row.sourceUrl) previous.evidenceUrls = [...new Set([...previous.evidenceUrls, row.sourceUrl])];
      previous.sourceHints = [...new Set([...previous.sourceHints, row.usage, row.note].filter(Boolean))];
      if (!previous.companyId && row.companyId) previous.companyId = row.companyId;
      if (!previous.hqCity && row.hqCity) previous.hqCity = row.hqCity;
      previous.priorityMajors = [...new Set([...previous.priorityMajors, ...(row.claimedMajors || [])])];
      if (!previous.opportunityId && row.opportunityId) previous.opportunityId = row.opportunityId;
    }
  }
  return [...byKey.values()];
}

function coverage(rows, channelType, now = new Date()) {
  const verified = rows.filter((row) => row.channelType === channelType && row.verificationStatus === "verified" && row.acceptsTrainingApplications && (!row.expiresAt || new Date(row.expiresAt) >= now));
  const bySegment = new Map();
  for (const row of verified) {
    for (const major of row.allMajors ? ["جميع التخصصات"] : row.majors || []) {
      for (const city of row.allSaudi ? ["جميع المدن"] : row.cities || []) {
        const key = `${major}\n${city}`;
        if (!bySegment.has(key)) bySegment.set(key, new Set());
        bySegment.get(key).add(row.companyId ? String(row.companyId) : row.companyNormalized);
      }
    }
  }
  return [...bySegment].map(([key, companies]) => ({ major: key.split("\n")[0], city: key.split("\n")[1], companies: companies.size })).sort((a, b) => b.companies - a.companies || a.major.localeCompare(b.major, "ar") || a.city.localeCompare(b.city, "ar"));
}

const GROUP_MAJORS = {
  Computing: ["تقنية المعلومات", "نظم المعلومات", "نظم المعلومات الإدارية", "علوم الحاسب", "هندسة البرمجيات", "الأمن السيبراني", "علم البيانات", "الذكاء الاصطناعي"],
  "Accounting/Finance": ["المحاسبة", "المالية"],
  HR: ["الموارد البشرية"],
  Engineering: ["الهندسة", "الهندسة الصناعية", "الهندسة الكهربائية", "الهندسة الميكانيكية", "الهندسة المدنية"],
};
const EASTERN_CITIES = new Set(["الخبر", "الدمام", "الظهران", "الأحساء", "الجبيل", "المنطقة الشرقية", "الشرقية"]);
function coverageBreakdown(rows, now = new Date()) {
  const groups = { city: { Riyadh: new Set(), Jeddah: new Set(), Eastern: new Set(), Other: new Set(), Unknown: new Set() },
    major: { Computing: new Set(), "Accounting/Finance": new Set(), HR: new Set(), Engineering: new Set(), Other: new Set(), Unknown: new Set() } };
  for (const row of rows.filter((item) => item.verificationStatus === "verified" && item.acceptsTrainingApplications && (!item.expiresAt || new Date(item.expiresAt) >= now))) {
    const company = String(row.companyId || row.companyNormalized);
    const cities = row.allSaudi ? ["الرياض", "جدة", "الشرقية", "مدينة أخرى"] : row.cities || [];
    if (!cities.length) groups.city.Unknown.add(company);
    for (const city of cities) groups.city[city === "الرياض" ? "Riyadh" : city === "جدة" ? "Jeddah" : EASTERN_CITIES.has(city) ? "Eastern" : "Other"].add(company);
    const majors = row.allMajors ? Object.values(GROUP_MAJORS).flat() : row.majors || [];
    if (!majors.length) groups.major.Unknown.add(company);
    for (const major of majors) {
      const key = Object.keys(GROUP_MAJORS).find((group) => GROUP_MAJORS[group].includes(major)) || "Other";
      groups.major[key].add(company);
    }
  }
  return Object.fromEntries(Object.entries(groups).map(([dimension, buckets]) => [dimension,
    Object.fromEntries(Object.entries(buckets).map(([name, companies]) => [name, companies.size]))]));
}

module.exports = { candidateKey, normalizeEmail, blockedInbox, detectedPurpose, validateReview, uniqueCandidates, coverage, coverageBreakdown };

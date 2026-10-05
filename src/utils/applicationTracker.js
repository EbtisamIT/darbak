export const studentStatuses = [
  ["applied", "تم التقديم"], ["waiting", "بانتظار الرد"], ["contacted", "تم التواصل معي"],
  ["interview", "مقابلة"], ["action_required", "مطلوب مستند / إجراء"],
  ["accepted", "تم القبول"], ["rejected", "لم يتم القبول"], ["withdrawn", "أوقفت التقديم"],
];
const labels = Object.fromEntries(studentStatuses);
export const isCompanyApplication = (item) => item.recordType === "darbak" || item.sourceType === "darbak" || Boolean(item.companyStatus);
export const applicationStatus = (item) => {
  if (isCompanyApplication(item)) return item.companyStatus || item.status || "submitted";
  const status = item.studentStatus || "applied";
  return ({ under_review: "waiting", offer: "accepted" })[status] || status;
};
export const statusLabel = (item) => isCompanyApplication(item)
  ? item.statusLabel || ({ submitted: "تم التقديم", under_review: "قيد المراجعة", shortlisted: "مرشح", accepted: "تم القبول", interview: "مقابلة", rejected: "لم يتم القبول", withdrawn: "أوقفت التقديم" })[applicationStatus(item)] || applicationStatus(item)
  : labels[applicationStatus(item)] || "تم الحفظ";
export const needsUpdate = (item, now = Date.now()) => !isCompanyApplication(item) &&
  ["applied", "waiting"].includes(applicationStatus(item)) &&
  now - new Date(item.lastUpdatedAt || item.updatedAt || item.appliedAt || item.submittedAt).getTime() > 7 * 86400000;
export const filterApplications = (items, filter, now = Date.now()) => items.filter((item) =>
  filter === "all" || (filter === "stale" ? needsUpdate(item, now) :
    filter === "waiting" ? ["applied", "waiting", "submitted", "under_review"].includes(applicationStatus(item)) : applicationStatus(item) === filter));
export const applicationSummary = (items) => ({ total: items.length,
  waiting: filterApplications(items, "waiting").length, interviews: filterApplications(items, "interview").length,
  accepted: filterApplications(items, "accepted").length });
export const formatApplicationDate = (value) => {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value));
};
export const nextStep = (item) => {
  if (isCompanyApplication(item)) return item.studentVisibleMessage || "ما عندك إجراء حاليًا";
  if (item.followUpAt) return `${applicationStatus(item) === "interview" ? "موعد المقابلة" : "موعد المتابعة"}: ${formatApplicationDate(item.followUpAt)}`;
  if (["applied", "waiting"].includes(applicationStatus(item))) return "بانتظار الرد من الجهة";
  if (applicationStatus(item) === "accepted") return "تم القبول — الخطوة التالية: التأكد من تاريخ بداية التدريب";
  if (applicationStatus(item) === "action_required" && item.note) return item.note;
  return "ما عندك إجراء حاليًا";
};
export const opportunityPath = (item) => item.opportunityId
  ? `/where-to-train/opportunity/training-opportunity/${encodeURIComponent(item.opportunityId)}` : "";

const DAY = 86400000;
const time = (value) => value ? new Date(value).getTime() : NaN;
export const appliedThisMonth = (item, now = Date.now()) => {
  const applied = time(item.appliedAt || item.submittedAt);
  if (!Number.isFinite(applied)) return false;
  const month = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit" }).format(date);
  return month(new Date(applied)) === month(new Date(now));
};
export const needsFollowUpReminder = (item, now = Date.now()) => {
  const applied = time(item.appliedAt);
  if (isCompanyApplication(item) || !item.contactEmail || !Number.isFinite(applied) || now - applied < 4 * DAY) return false;
  if (!["applied", "waiting"].includes(applicationStatus(item))) return false;
  const updated = time(item.lastUpdatedAt || item.updatedAt);
  if (Number.isFinite(updated) && updated > applied) return false;
  if (item.followUpDismissedAt) return false;
  if (time(item.followUpSnoozedUntil) > now) return false;
  if (now - time(item.followUpSentAt) < 7 * DAY) return false;
  return true;
};
export const applicationGroup = (item, now = Date.now()) => {
  const status = applicationStatus(item);
  if (["action_required", "contacted"].includes(status) || needsFollowUpReminder(item, now)) return "action";
  if (["applied", "waiting", "submitted", "under_review"].includes(status)) return "waiting";
  if (status === "interview") return "interview";
  if (["accepted", "offer"].includes(status)) return "accepted";
  return "other";
};
export const monthlySummary = (items, now = Date.now()) => {
  const counts = { waiting: 0, action: 0, interview: 0, accepted: 0 };
  items.forEach((item) => {
    if (!appliedThisMonth(item, now)) return;
    const group = applicationGroup(item, now);
    if (group in counts) counts[group] += 1;
  });
  return counts;
};
export const actionForApplication = (item, now = Date.now()) => {
  if (needsFollowUpReminder(item, now)) return "follow_up";
  if (["action_required", "contacted"].includes(applicationStatus(item))) return "information";
  if (applicationStatus(item) === "interview" && time(item.followUpAt) > now) return "interview";
  return "";
};
export const followUpMessage = (item, language = "ar", student = {}) => {
  const title = item.opportunityTitle || item.roleTitle || "[اسم الفرصة]";
  const company = item.organizationName || item.companyName || "[اسم الجهة]";
  const applied = time(item.appliedAt);
  const date = Number.isFinite(applied) ? new Intl.DateTimeFormat(language === "en" ? "en-GB" : "ar-SA-u-ca-gregory", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Riyadh",
  }).format(new Date(applied)) : (language === "en" ? "[Application Date]" : "[تاريخ التقديم]");
  if (language === "en") return {
    subject: `Follow-up on my ${title} application`,
    body: `Hello ${company} team,\n\nI am following up on my application for the ${title} opportunity, submitted on ${date}.\n\nI remain interested in the opportunity and would be happy to provide any additional information if needed.\n\nThank you for your time and consideration.\n\nBest regards,\n${student.name || "[Student Name]"}\n${student.contact || "[Phone number or portfolio link, if available]"}`,
  };
  return {
    subject: `متابعة طلب التقديم على ${title}`,
    body: `السلام عليكم فريق ${company}،\n\nأود المتابعة بخصوص طلبي المقدم على فرصة ${title} بتاريخ ${date}.\n\nلا يزال الاهتمام بالفرصة قائمًا، ويسعدني تزويدكم بأي معلومات إضافية عند الحاجة.\n\nشكرًا لوقتكم وتقديركم.\n\nتحياتي،\n${student.name || "[اسم الطالب]"}\n${student.contact || "[رقم الجوال أو رابط الملف المهني - عند توفره]"}`,
  };
};

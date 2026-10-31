const EMAIL_PATTERN = /^[^\s@,;?]+@[^\s@,;?]+\.[^\s@,;?]+$/;
const GENERIC_TITLES = new Set(["تدريب", "تدريب تعاوني", "فرصة تدريب", "فرصة تدريب تعاوني", "co-op", "internship"]);

export const getApplicationEmail = (opportunity = {}) => {
  const url = String(opportunity.applicationUrl || "").trim();
  const fromUrl = /^mailto:/i.test(url) ? url.slice(7).split("?")[0] : url;
  return [opportunity.applicationEmail, opportunity.contactEmail, fromUrl]
    .map((value) => String(value || "").trim())
    .find((candidate) => EMAIL_PATTERN.test(candidate)) || "";
};

export const isEmailApplication = (opportunity = {}) => {
  const url = String(opportunity.applicationUrl || "").trim();
  return opportunity.applicationMethod === "email" || /^mailto:/i.test(url) || EMAIL_PATTERN.test(url);
};

export const getEmailApplicationSubject = (opportunity = {}) => {
  const title = String(opportunity.title || "").trim();
  const company = String(opportunity.organizationName || "جهة التدريب").trim();
  return title && !GENERIC_TITLES.has(title.toLowerCase())
    ? `التقديم على فرصة التدريب التعاوني – ${title}`
    : `طلب تدريب تعاوني – ${company}`;
};

export const getEmailApplicationMessage = (opportunity = {}, studentName = "") => {
  const company = String(opportunity.organizationName || "الجهة").trim();
  const title = String(opportunity.title || "").trim();
  const titlePart = title && !GENERIC_TITLES.has(title.toLowerCase()) ? ` – ${title}` : "";
  return `السلام عليكم ورحمة الله وبركاته،\n\nأرغب بالتقديم على فرصة التدريب التعاوني لدى ${company}${titlePart}.\n\nأرفقت سيرتي الذاتية للاطلاع، وأتطلع لفرصة الانضمام والتدريب لديكم.\n\nشكرًا لكم،\n${studentName || "اسمك"}`;
};

export const buildEmailApplicationHref = ({ email, subject, body }) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const getEmailApplicationFallback = (opportunity = {}) => {
  const source = String(opportunity.sourceUrl || "").trim();
  try {
    const url = new URL(source);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

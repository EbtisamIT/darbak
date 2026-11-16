const { normalizeEmail } = require("./autoApplyEmailNetwork");

const FIELD_OPTIONS = {
  "تقنية المعلومات": ["تطوير الويب", "تطوير البرمجيات", "تحليل البيانات", "تحليل الأعمال", "الأمن السيبراني", "الشبكات", "الدعم التقني", "أنظمة ERP", "إدارة المشاريع", "تصميم UI/UX", "الذكاء الاصطناعي", "تقنية المعلومات العامة"],
  "نظم المعلومات": ["تحليل الأعمال", "تحليل البيانات", "أنظمة ERP", "إدارة المشاريع", "تطوير البرمجيات", "تصميم UI/UX", "تقنية المعلومات العامة"],
  "علوم الحاسب": ["تطوير الويب", "تطوير البرمجيات", "تحليل البيانات", "الأمن السيبراني", "الشبكات", "الذكاء الاصطناعي"],
  "المحاسبة": ["المحاسبة المالية", "المراجعة", "الزكاة والضرائب", "التقارير المالية"],
  "المالية": ["التحليل المالي", "الاستثمار", "التقارير المالية", "إدارة المخاطر"],
  "الموارد البشرية": ["التوظيف", "عمليات الموارد البشرية", "التدريب والتطوير", "تحليل بيانات الموارد البشرية"],
  "إدارة الأعمال": ["إدارة المشاريع", "العمليات", "تطوير الأعمال", "تحليل الأعمال"],
  "التسويق": ["التسويق الرقمي", "المحتوى", "أبحاث السوق", "إدارة الحملات"],
};
const COMMON_FIELDS = ["أخرى"];
const EDUCATION_LEVELS = ["diploma", "bachelor", "master", "other"];
const TRAINING_TYPES = ["coop", "internship", "summer", "other"];
const PACKAGE_STATUSES = ["matched", "ready_for_review", "approved", "sent", "skipped", "needs_action", "failed"];
const clean = (value, limit = 180) => String(value || "").trim().slice(0, limit);
const unique = (values, limit = 20) => [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 120)).filter(Boolean))].slice(0, limit);
const majorAliases = { "it": "تقنية المعلومات", "information technology": "تقنية المعلومات", "information systems": "نظم المعلومات", "mis": "نظم المعلومات الإدارية", "computer science": "علوم الحاسب", "accounting": "المحاسبة", "finance": "المالية", "human resources": "الموارد البشرية" };
const cityAliases = { "riyadh": "الرياض", "jeddah": "جدة", "dammam": "الدمام", "khobar": "الخبر", "dhahran": "الظهران", "makkah": "مكة المكرمة" };
const canonicalMajor = (value) => majorAliases[clean(value).toLocaleLowerCase()] || clean(value);
const canonicalCity = (value) => cityAliases[clean(value).toLocaleLowerCase()] || clean(value);

function validateProfile(input = {}) {
  const educationLevel = clean(input.educationLevel, 30);
  const major = clean(input.major);
  const customMajor = clean(input.customMajor);
  const preferredFields = unique(input.preferredFields);
  const preferredCities = unique(input.preferredCities);
  const trainingTypes = unique(input.trainingTypes);
  const excludedCompanyIds = unique(input.excludedCompanyIds);
  const mode = input.mode || "review_first";
  if (!EDUCATION_LEVELS.includes(educationLevel) || (!major && !customMajor) || !preferredFields.length || !preferredCities.length ||
    trainingTypes.some((type) => !TRAINING_TYPES.includes(type)) || !["review_first", "automatic"].includes(mode)) {
    throw Object.assign(new Error("أكملي المؤهل والتخصص ومجالات التدريب والمدن قبل المتابعة."), { status: 400 });
  }
  if (preferredFields.includes("أخرى") && !clean(input.customField)) {
    throw Object.assign(new Error("اكتبي المجال الآخر الذي تريدينه."), { status: 400 });
  }
  const trainingStartDate = input.trainingStartDate ? new Date(input.trainingStartDate) : null;
  if (trainingStartDate && Number.isNaN(trainingStartDate.getTime())) throw Object.assign(new Error("تاريخ البداية غير صالح."), { status: 400 });
  return { educationLevel, major, customMajor, preferredFields, customField: clean(input.customField), preferredCities,
    allowRemote: input.allowRemote === true, trainingTypes, trainingStartDate,
    trainingDuration: clean(input.trainingDuration, 80), excludedCompanyIds, mode, paused: input.paused === true };
}

function isCurrentVerifiedChannel(channel, now = new Date()) {
  return channel?.verificationStatus === "verified" && channel.acceptsTrainingApplications === true &&
    ["active_opportunity", "evergreen_training"].includes(channel.channelType) &&
    (!channel.expiresAt || new Date(channel.expiresAt) >= now) && Boolean(normalizeEmail(channel.email));
}

function evaluateChannel(profile, channel, opportunity = null, alreadyApplied = false, now = new Date()) {
  if (!isCurrentVerifiedChannel(channel, now)) return null;
  const companyId = String(channel.companyId || channel.companyNormalized || channel.company || "");
  if (profile.excludedCompanyIds?.includes(companyId) || alreadyApplied) return null;
  const target = opportunity || {};
  const reasons = [], blockers = [], matchedFields = [];
  const studentMajor = canonicalMajor(profile.major || profile.customMajor).toLocaleLowerCase();
  const acceptedMajors = (channel.majors || []).map((value) => canonicalMajor(value).toLocaleLowerCase());
  if (channel.allMajors) reasons.push("الجهة تقبل جميع التخصصات حسب الدليل الموثق");
  else if (acceptedMajors.includes(studentMajor)) reasons.push("تخصصك مذكور صراحة في شروط الجهة");
  else if (!acceptedMajors.length) blockers.push("التخصصات المقبولة غير محددة");
  else blockers.push("تخصصك غير مذكور في شروط الجهة");

  const cities = (channel.cities || []).map((value) => canonicalCity(value).toLocaleLowerCase());
  const preferred = (profile.preferredCities || []).map((value) => canonicalCity(value).toLocaleLowerCase());
  if (channel.allSaudi) reasons.push("التدريب متاح في جميع المدن حسب الدليل الموثق");
  else if (cities.some((city) => preferred.includes(city))) reasons.push("مدينة التدريب ضمن مدنك المختارة");
  else if (channel.remote && profile.allowRemote) reasons.push("الجهة تتيح التدريب عن بُعد");
  else if (!cities.length && !channel.remote) blockers.push("مدينة التدريب غير محددة");
  else blockers.push("مدينة التدريب لا تطابق اختياراتك");

  const targetFields = unique([...(channel.preferredFields || []), ...(target.preferredFields || [])]);
  for (const field of targetFields) {
    if (profile.preferredFields?.some((chosen) => chosen.toLocaleLowerCase() === field.toLocaleLowerCase())) matchedFields.push(field);
  }
  if (!targetFields.length) blockers.push("مجال التدريب التفصيلي غير محدد");
  else if (!matchedFields.length) blockers.push("مجال التدريب لا يطابق المجالات التي اخترتها");
  else reasons.push(`المجال المناسب: ${matchedFields[0]}`);

  if (target.educationLevels?.length && !target.educationLevels.includes(profile.educationLevel)) blockers.push("مستوى المؤهل لا يطابق شرط الفرصة");
  if (target.trainingTypes?.length && profile.trainingTypes?.length &&
    !target.trainingTypes.some((type) => profile.trainingTypes.includes(type))) blockers.push("نوع التدريب لا يطابق اختيارك");
  if (target.deadline && new Date(target.deadline) < now) blockers.push("انتهى موعد التقديم");
  const hardMismatch = blockers.some((reason) => reason.includes("لا يطابق") || reason.includes("لا تطابق") || reason.includes("غير مذكور") || reason.includes("انتهى موعد"));
  return { eligibility: blockers.length ? (hardMismatch ? "not_eligible" : "needs_review") : "eligible",
    matchConfidence: blockers.length ? (hardMismatch ? "low" : "unknown") : "high",
    matchedFields, reasons, blockers };
}

function applicationMessage({ profile, channel, opportunity, studentName }) {
  const companyName = clean(channel.company, 180) || "الجهة";
  const major = clean(profile.major || profile.customMajor);
  const name = clean(studentName) || "اسمك";
  const title = clean(opportunity?.title);
  const field = unique(profile.preferredFields).find((item) => item !== "أخرى") || clean(profile.customField);
  const period = [profile.trainingStartDate && new Date(profile.trainingStartDate).toISOString().slice(0, 10), profile.trainingDuration].filter(Boolean).join(" لمدة ");
  const periodSentence = period ? `الفترة المناسبة لي للتدريب تبدأ ${period}.` : "";
  if (title) return {
    subject: `التقديم على ${title}${major ? ` – ${major}` : ""} – ${name}`,
    body: ["السلام عليكم ورحمة الله وبركاته،", `أتقدم بطلب الانضمام إلى ${title} لدى ${companyName}.`,
      major ? `أدرس تخصص ${major}${field ? `، وأرغب بتطوير خبرتي العملية في مجال ${field}` : ""}.` : "",
      "أرفقت سيرتي الذاتية للاطلاع، ويسعدني تزويدكم بأي معلومات إضافية عند الحاجة.", "شكرًا لكم،", name].filter(Boolean).join("\n\n"),
  };
  return {
    subject: `طلب تدريب تعاوني${major ? ` – ${major}` : ""} – ${name}`,
    body: ["السلام عليكم ورحمة الله وبركاته،", `أرغب بالتقديم على فرص التدريب التعاوني المتاحة لدى ${companyName}.`,
      major ? `أدرس تخصص ${major}${field ? `، وأهتم بمجال ${field}` : ""}.` : "",
      periodSentence, "أرفقت سيرتي الذاتية للاطلاع، وأتطلع إلى فرصة التدريب لديكم.", "شكرًا لكم،", name].filter(Boolean).join("\n\n"),
  };
}

module.exports = { FIELD_OPTIONS, COMMON_FIELDS, PACKAGE_STATUSES, validateProfile, isCurrentVerifiedChannel, evaluateChannel, applicationMessage };

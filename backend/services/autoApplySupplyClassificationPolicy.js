const { blockedInbox } = require("./autoApplyEmailNetwork");
const { programType, geography, secureUrl, channelForUrl } = require("./autoApplySupplyExtraction");
const { channelTypes } = require("../models/AutoApplySupply");

const OFFICIAL = new Set(["official_company_website", "official_careers_page", "official_job_program_page",
  "official_announcement", "public_ats_job_page", "darbak_reviewed_opportunity"]);
const TRAINING_RE = /\b(?:co[ -]?op|cooperative training|internship|summer training|student program|training program for (?:students|graduates)|graduate (?:training|development) program)\b|التدريب التعاوني|تدريب تعاوني|التدريب الصيفي|تدريب صيفي|تدريب.{0,22}(?:الطلبة|الطلاب|طلاب|الخريجين)|برنامج.{0,22}(?:الطلاب|الطلبة|الخريجين)/i;
const EMAIL_RE = /[a-z0-9.!#$%&'*+/=?^_{}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const EMAIL_ACTION = /\b(?:send|email|submit|forward)\b.{0,100}\b(?:cv|résumé|resume|application|request)\b|\b(?:apply|applications?)\b.{0,55}(?:\b(?:via|by email|email|send to|sent to)\b|to:)|(?:أرسل|ارسل|إرسال|ارسال|ترسل|ترسلوا|تُرسل|إرفاق).{0,66}(?:السيرة|طلب|طلبات|التقديم)|(?:التقديم|طلبات التدريب).{0,40}(?:عبر|على البريد|إلى البريد)/i;
const GENERAL_CONTACT = /\b(?:for inquiries|general inquiries|customer service|questions only|technical support)\b|للاستفسارات|للاستفسار|خدمة العملاء|الدعم الفني/i;
const APPLICATION_ACTION = /^(?:apply\b|application form\b|register\b|submit\b|التقديم|تقديم|قدّم|قدم|تقدّم|سجل|سجّل|التسجيل)/i;
const ROLE_CONFLICT = /\b(?:manager|director|headhunter|trainer|recruiter)\b|مدير|مدرب|أخصائي التوظيف/i;
const NON_SAUDI = /\b(?:United Arab Emirates|Dubai|Abu Dhabi|London|United Kingdom|United States|Canada|India|Egypt|Cairo|Qatar|Kuwait|Bahrain)\b|الإمارات|دبي|أبوظبي|مصر|القاهرة|قطر|الكويت|البحرين/i;
const SAUDI = /\b(?:Saudi Arabia|KSA|Riyadh|Jeddah|Dammam|Dhahran|Khobar|Makkah)\b|السعودية|الرياض|جدة|الدمام|الظهران|الخبر|مكة/i;
const GEO_LABEL = /\b(?:location|located|based|training in|internship in|program in|on.site in|taking place)\b|(?:موقع|مكان|مدينة|مقر)\s*(?:التدريب|البرنامج)|(?:التدريب|البرنامج)\s*في/i;
const HQ = /\b(?:headquarters|head office|corporate office)\b|المقر الرئيسي|المركز الرئيسي/i;
const NEGATIVE = /\b(?:not|except|without|excluded|optional)\b|غير مطلوب|اختياري|غير مؤهل|لا يقبل|لا يشترط|لا يلزم|لا ترسل|لا تُرسل|عدم الإرسال|باستثناء/i;
const CLOSED = /\b(?:applications? (?:are )?closed|no longer accepting applications|registration (?:is )?closed)\b|انتهى التقديم|انتهت فترة التقديم|التقديم مغلق|التسجيل مغلق/i;
const END_DATE = /\b(?:deadline|closing date|apply by|applications? close)\b|آخر موعد|الموعد النهائي|يغلق التقديم|إغلاق التقديم/i;
const START_DATE = /\b(?:start date|starts on|program begins|training begins)\b|تاريخ بدء|يبدأ التدريب|بداية التدريب/i;
const FIELD_CUES = {
  majors: /\b(?:majors?|speciali[sz]ations?|degree in|students? in)\b|تخصص|تخصصات/i,
  fields: /\b(?:fields?|tracks?|departments?|roles?)\b|مجال|مسار|قسم/i,
  cities: GEO_LABEL,
  educationLevels: /\b(?:bachelor|undergraduate|diploma|master|phd|education|qualification|degree)\b|بكالوريوس|دبلوم|ماجستير|دكتوراه|مؤهل/i,
  requiredDocuments: /\b(?:must attach|required documents?|must submit|mandatory|attach|include)\b|المستندات المطلوبة|الوثائق المطلوبة|يجب.{0,30}(?:إرفاق|تقديم)|أرفق|ارفق|إرفاق/i,
};

function evidenceFields(record) {
  return Object.fromEntries(Object.entries({
    evidenceText: record.evidenceText?.slice(0, 4000), emailEvidenceText: record.emailEvidenceText?.slice(0, 1500),
    applicationEvidenceText: record.applicationEvidenceText?.slice(0, 1500), pageTitle: record.pageTitle?.slice(0, 500),
    opportunityTitle: record.opportunityTitle?.slice(0, 300), companyName: record.companyName?.slice(0, 300),
  }).filter(([, value]) => value));
}

function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function evidenceDays(quote) {
  const text = quote.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const days = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  const months = ["january jan يناير", "february feb فبراير", "march mar مارس", "april apr أبريل ابريل", "may مايو",
    "june jun يونيو", "july jul يوليو", "august aug أغسطس اغسطس", "september sep سبتمبر", "october oct أكتوبر اكتوبر",
    "november nov نوفمبر", "december dec ديسمبر"];
  const tokens = months.flatMap((entry) => entry.split(" "));
  const named = new RegExp("(\\d{1,2})\\s+(" + tokens.join("|") + ")\\s+(\\d{4})", "giu");
  for (const [, day, month, year] of text.matchAll(named)) {
    const index = months.findIndex((entry) => entry.split(" ").includes(month.toLowerCase()));
    days.push(year + "-" + String(index + 1).padStart(2, "0") + "-" + day.padStart(2, "0"));
  }
  const monthFirst = new RegExp("(" + tokens.join("|") + ")\\s+(\\d{1,2})(?:,\\s*|\\s+)(\\d{4})", "giu");
  for (const [, month, day, year] of text.matchAll(monthFirst)) {
    const index = months.findIndex((entry) => entry.split(" ").includes(month.toLowerCase()));
    days.push(year + "-" + String(index + 1).padStart(2, "0") + "-" + day.padStart(2, "0"));
  }
  for (const [, left, right, year] of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    if ((+left > 12) === (+right > 12)) continue;
    const [day, month] = +left > 12 ? [left, right] : [right, left];
    days.push(year + "-" + month.padStart(2, "0") + "-" + day.padStart(2, "0"));
  }
  return days.filter(validDay);
}

const clauses = (value) => String(value || "").split(/\n|[!?؟؛]|[.](?=\s|$)/u).map((part) => part.trim()).filter(Boolean);
function containsLiteral(quote, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?<![\\p{L}\\p{N}])" + escaped + "(?![\\p{L}\\p{N}])", "iu").test(quote);
}

function trainingEmailEvidence(record, title) {
  if (!record.destinationEmail || blockedInbox(record.destinationEmail)) return null;
  const destination = record.destinationEmail.toLowerCase();
  for (const field of ["emailEvidenceText", "evidenceText"]) {
    for (const quote of clauses(record[field])) {
      const emails = (quote.match(EMAIL_RE) || []).map((email) => email.toLowerCase());
      const wording = quote.replace(EMAIL_RE, " ");
      if (emails.length !== 1 || emails[0] !== destination || !EMAIL_ACTION.test(wording) ||
        !(TRAINING_RE.test(wording) || (TRAINING_RE.test(title) && /this (?:training )?program|هذا البرنامج|لهذا البرنامج/i.test(wording))) ||
        GENERAL_CONTACT.test(wording) || NEGATIVE.test(wording)) continue;
      return { field: "emailAcceptsTrainingApplications", sourceField: field, value: destination, quote: quote.slice(0, 750) };
    }
  }
  return null;
}

function explicitPortalEvidence(record) {
  if (record.channelType === "COMPANY_PORTAL") {
    const url = secureUrl(record.applicationUrl);
    if (!url) return null;
    const target = new URL(url);
    if (/^\/(?:(?:ar|en)\/)?(?:careers?|jobs?|apply|opportunities)?\/?$/i.test(target.pathname) &&
      !["jobId", "jobID", "job_id", "gh_jid", "reqId", "requisitionId"].some((key) => target.searchParams.get(key))) return null;
  }
  const quote = record.applicationEvidenceText?.trim();
  if (quote && APPLICATION_ACTION.test(quote) && !NEGATIVE.test(quote) &&
    !/privacy|policy|faq|سياسة|استفسار/i.test(quote)) {
    return { field: "channelAssessment", sourceField: "applicationEvidenceText", value: record.applicationUrl, quote: quote.slice(0, 750) };
  }
  if (record.sourceType === "darbak_reviewed_opportunity" && record.channelType === "DARBAK_APPLICATION" && record.opportunityId &&
    record.sourceUrl === record.applicationUrl) {
    return { field: "channelAssessment", sourceField: "opportunityTitle", value: record.applicationUrl, quote: record.opportunityTitle };
  }
  return null;
}

function decision(status, rule, reason) {
  return { status, rule, reason };
}

function classifyByPolicy(record, ai, now = new Date()) {
  const raw = evidenceFields(record);
  const references = [];
  const extracted = {};
  function findQuote(field, value, validate) {
    return ai?.evidenceQuotes.find((ref) => ref.field === field && ref.value === String(value) &&
      raw[ref.sourceField]?.includes(ref.quote) && validate(ref.quote, ref.sourceField));
  }
  function supportedValue(field, value, test) {
    if (value == null || value === "") return null;
    const match = findQuote(field, value, test);
    if (!match) return null;
    references.push(match);
    return value;
  }
  function supportedList(field) {
    return [...new Set(ai?.[field] || [])].filter((value) => supportedValue(field, value,
      (quote, sourceField) => ["evidenceText", "emailEvidenceText", "applicationEvidenceText"].includes(sourceField) &&
        FIELD_CUES[field].test(quote) && !NEGATIVE.test(quote) && (field !== "cities" || !HQ.test(quote)) && containsLiteral(quote, value)));
  }

  const title = [record.opportunityTitle, record.pageTitle].filter(Boolean).join(" ");
  const sourceEvidence = [record.evidenceText, record.emailEvidenceText, record.applicationEvidenceText].filter(Boolean).join("\n");
  const body = title + "\n" + sourceEvidence;
  const type = !ROLE_CONFLICT.test(title) && (programType(record.opportunityTitle || record.pageTitle || "", body) ||
    (TRAINING_RE.test(title) ? record.trainingType || null : null));
  const sourceUrl = secureUrl(record.sourceUrl);
  const geo = sourceUrl && geography({ remote: record.remote === true }, body, sourceUrl);
  const remoteAllowed = geo?.remote === true;
  const mentionedRemote = record.remote === true || /\b(?:remote|telecommute|work from home)\b|عن ب[ُ]?عد/i.test(body);
  const locationClauses = clauses(body).filter((quote) => GEO_LABEL.test(quote) && !HQ.test(quote));
  const foreignLocation = locationClauses.some((quote) => NON_SAUDI.test(quote));
  const localLocation = locationClauses.some((quote) => SAUDI.test(quote));
  const channelUrl = secureUrl(record.applicationUrl);
  const emailValid = (record.destinationEmail?.match(EMAIL_RE) || [])[0] === record.destinationEmail && Boolean(record.destinationEmail);
  const validChannel = channelTypes.includes(record.channelType) && (record.channelType === "EMAIL" ? emailValid :
    Boolean(channelUrl && channelForUrl(channelUrl) === record.channelType));

  extracted.companyName = supportedValue("companyName", ai?.companyName, (quote) => containsLiteral(quote, ai.companyName));
  extracted.opportunityTitle = supportedValue("opportunityTitle", ai?.opportunityTitle, (quote) => containsLiteral(quote, ai.opportunityTitle));
  extracted.trainingType = ai?.trainingType === type ? supportedValue("trainingType", ai.trainingType, (quote) => TRAINING_RE.test(quote)) : null;
  for (const field of Object.keys(FIELD_CUES)) extracted[field] = supportedList(field);
  extracted.remote = ai?.remote === true && remoteAllowed ?
    supportedValue("remote", true, (quote) => geography({ remote: true }, quote, sourceUrl)?.remote === true) : null;
  for (const [field, cue] of [["deadline", END_DATE], ["startDate", START_DATE]]) {
    extracted[field] = supportedValue(field, validDay(ai?.[field]), (quote) => cue.test(quote) && evidenceDays(quote).includes(ai[field]));
  }

  // A stated date can close a listing even if the model omitted it. Conflicting
  // dates cannot independently promote a record.
  const deadlineClauses = clauses(sourceEvidence).filter((quote) => END_DATE.test(quote));
  const statedDeadlines = [...new Set(deadlineClauses.flatMap(evidenceDays))];
  const inferredDeadline = statedDeadlines.length === 1 ? statedDeadlines[0] : null;
  const dated = inferredDeadline ? new Date(inferredDeadline + "T23:59:59.999+03:00") : null;
  const knownDates = [record.deadline, record.expiresAt, dated].filter((value) => value && Number.isFinite(+new Date(value))).map((value) => new Date(value));
  const effectiveDeadline = knownDates.length ? new Date(Math.min(...knownDates.map(Number))) : null;
  if (dated) {
    for (const field of ["evidenceText", "emailEvidenceText", "applicationEvidenceText"]) {
      const quote = clauses(raw[field]).find((clause) => END_DATE.test(clause) && evidenceDays(clause).includes(inferredDeadline));
      if (quote) { references.push({ field: "deadline", sourceField: field, value: inferredDeadline, quote: quote.slice(0, 750) }); break; }
    }
  }
  const channelProof = validChannel && (record.channelType === "EMAIL" ? trainingEmailEvidence(record, title) : explicitPortalEvidence(record));
  if (channelProof) references.push(channelProof);
  const trainingProof = type && (TRAINING_RE.test(record.opportunityTitle || "") ?
    { sourceField: "opportunityTitle", quote: record.opportunityTitle } : clauses(sourceEvidence).find((quote) => TRAINING_RE.test(quote)));
  if (trainingProof && typeof trainingProof === "object") references.push({ field: "isTrainingRelevant", value: "true", ...trainingProof });

  let outcome;
  if (record.geographyStatus === "NON_SAUDI") outcome = decision("REJECTED", "UNSUPPORTED_GEOGRAPHY", "The stated training location is outside Saudi Arabia.");
  else if (effectiveDeadline && effectiveDeadline <= now) outcome = decision("EXPIRED", "DEADLINE_PASSED", "An explicit closing or expiry date has passed.");
  else if (!validChannel) outcome = decision("REJECTED", "INVALID_CHANNEL", "The application channel is missing, unsupported, or invalid.");
  else if (foreignLocation && !localLocation && !remoteAllowed) outcome = decision("REJECTED", "UNSUPPORTED_GEOGRAPHY", "The stated training location is outside Saudi Arabia.");
  else if (ROLE_CONFLICT.test(title) && !type) outcome = decision("REJECTED", "NON_TRAINING_ROLE", "The listing describes a hiring or training-staff role.");
  else if (!type && /\bfull.time (?:employment|position|role|job)\b|وظيفة بدوام كامل/i.test(body) && !TRAINING_RE.test(body)) {
    outcome = decision("REJECTED", "NON_TRAINING_ROLE", "The evidence describes employment without a training program.");
  } else if (CLOSED.test(sourceEvidence)) outcome = decision("NEEDS_REVIEW", "CLOSE_SIGNAL_WITHOUT_DATE", "The source mentions a closure without an unambiguous past deadline.");
  else if (mentionedRemote && !remoteAllowed) outcome = decision("NEEDS_REVIEW", "REMOTE_SAUDI_UNCONFIRMED", "The remote program does not explicitly accept applicants in Saudi Arabia.");
  else if (record.employerName === null || record.companyName === "unknown") outcome = decision("NEEDS_REVIEW", "EMPLOYER_UNRESOLVED", "The employer has not been established.");
  else if (!type || (!geo && record.geographyStatus !== "SAUDI") || record.geographyStatus === "UNKNOWN" ||
    ai?.isTrainingRelevant !== true || statedDeadlines.length > 1 ||
    (deadlineClauses.length > 0 && !effectiveDeadline) || (foreignLocation && localLocation) ||
    ai.evidenceStrength === "conflicting" || ai.channelAssessment === "conflicting") {
    outcome = decision("NEEDS_REVIEW", "AMBIGUOUS_EVIDENCE", "Training relevance, Saudi coverage, or dates need review.");
  } else if (!sourceUrl || !OFFICIAL.has(record.sourceType) || !record.collectorSource || !channelProof ||
    ["SECONDARY_DISCOVERY", "OTHER"].includes(record.sourceRole)) {
    outcome = decision("LIKELY", "APPLICATION_EVIDENCE_INCOMPLETE", "Training evidence is present, but the source or exact application channel is not verified.");
  } else {
    outcome = decision("VERIFIED", record.channelType === "EMAIL" ? "EXPLICIT_TRAINING_EMAIL" : "EXPLICIT_APPLICATION_CHANNEL",
      "An approved source explicitly documents this channel for the Saudi training program.");
  }

  extracted.isTrainingRelevant = type ? true : null;
  extracted.channelAssessment = channelProof ? "explicit_application" : "incomplete";
  extracted.emailAcceptsTrainingApplications = record.channelType === "EMAIL" && channelProof ? true : null;
  extracted.evidenceStrength = channelProof && type ? "explicit" : type ? "partial" : "none";
  return { ...outcome, extraction: extracted, evidenceReferences: references.slice(0, 80), effectiveDeadline,
    emailExplicitlySupported: outcome.status === "VERIFIED" && record.channelType === "EMAIL" };
}

module.exports = { classifyByPolicy, evidenceFields };

const { cities } = require("../../../src/data/trainingVocabulary.json");

const SAUDI = /\b(?:Saudi Arabia|KSA|Riyadh|Jeddah|Jiddah|Dammam|Dhahran|Khobar|Mecca|Makkah|Medina|Madinah|Jubail|Tabuk|Abha|Jazan|Yanbu)\b|السعودية|السعوديه/i;
const FOREIGN = /\b(?:Tamil Nadu|India|Indian|UAE|United Arab Emirates|Dubai|Abu Dhabi|Egypt|Cairo|Qatar|Doha|Kuwait|Bahrain|Oman|Pakistan|Bangladesh|United States|USA|United Kingdom|UK|London|Singapore)\b|الهند|الإمارات|الامارات|دبي|أبو ظبي|ابو ظبي|مصر|القاهرة|قطر|الدوحة|الكويت|البحرين|عمان|باكستان|بنغلاديش/i;
const REMOTE = /\bremote\b|عن بعد/i;
const SAUDI_ELIGIBILITY = /(?:accept|eligible|open to|welcome|applicants? from|students? from|residents? of)[^.\n]{0,100}(?:Saudi Arabia|KSA|Saudi students)|(?:Saudi Arabia|KSA|Saudi students)[^.\n]{0,70}(?:eligible|can apply|accepted)|(?:يقبل|متاح|مؤهل|طلاب|طلبة|يمكن)[^.\n]{0,80}(?:السعودية|السعوديين)/i;
const SOCIAL = /(?:^|\.)(?:tiktok\.com|x\.com|twitter\.com|instagram\.com|linkedin\.com|facebook\.com|t\.me|telegram\.me)$/i;

function knownCompany(value) {
  const name = String(value || "").trim();
  return Boolean(name && !/^(?:unknown|unspecified|غير محدد(?:ة)?|جهة غير محددة|شركة غير محددة)$/i.test(name));
}

// Search queries express our intent, not facts about the returned advert.
function candidateAdmission(data, source = {}) {
  const title = String(data.title || "");
  const description = String(data.description || "");
  const location = [...(data.cities || []), ...(data.rawCities || []), data.city || ""].join(" ");
  const text = `${title}\n${description}\n${data.rawContent || ""}\n${location}`;
  const locationStatements = description.match(/(?:location|based in|located in|(?:internship|training|role|position) in|موقع التدريب|مكان التدريب|المدينة)\s*[:：]?[^.\n]{0,80}/gi) || [];
  const foreignLocation = FOREIGN.test(`${title} ${location}`) ||
    locationStatements.some((line) => FOREIGN.test(line));
  if (foreignLocation && !(REMOTE.test(text) && SAUDI_ELIGIBILITY.test(text))) {
    return { accepted: false, reason: "OUTSIDE_SAUDI" };
  }
  let url;
  try { url = new URL(data.sourceUrl || data.url); } catch { /* Missing URL is handled by candidate validation. */ }
  const explicitSaudi = SAUDI.test(text) || cities.some((city) => text.includes(city));
  const officialSaudi = Boolean(url && (/(?:^|\.)gov\.sa$|(?:^|\.)edu\.sa$/i.test(url.hostname) ||
    ["SA", "Saudi Arabia", "السعودية"].includes(source.country) &&
    [...(source.officialDomains || []), ...(source.careerDomains || [])].some((domain) => url.hostname === domain)));
  const company = knownCompany(data.company);
  if (url && SOCIAL.test(url.hostname)) {
    // Topic/search/profile pages are not independent adverts, even if their URL names a city.
    if (/^\/(?:discover|explore|search|tags?)(?:\/|$)/i.test(url.pathname)) return { accepted: false, reason: "SOCIAL_AGGREGATION" };
    if (!company && !explicitSaudi && !data.applicationUrl) return { accepted: false, reason: "SOCIAL_WITHOUT_EVIDENCE" };
  }
  return company || explicitSaudi || officialSaudi ? { accepted: true, reason: "ADMISSION_EVIDENCE_FOUND" } :
    { accepted: false, reason: "NO_SAUDI_OR_COMPANY_EVIDENCE" };
}

module.exports = { candidateAdmission };

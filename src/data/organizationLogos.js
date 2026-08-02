import { darbakGuideOrganizations } from "./darbakGuideSuggestions";
import { darbakContactDirectoryOrganizations } from "./darbakContactDirectory";

const LOGO_SIZE = 128;
const IMAGE_URL_PATTERN = /\.(png|jpe?g|webp|svg|gif)(\?.*)?$/i;
const GENERIC_LINK_DOMAINS = new Set([
  "docs.google.com",
  "drive.google.com",
  "forms.gle",
  "forms.office.com",
  "forms.cloud.microsoft",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "typeform.com",
  "form.typeform.com",
  "microsoft.com",
  "office.com",
  "surveys.mot.gov.sa",
]);

const normalizeLogoKey = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\s|/\\()[\]{}.,،:;'"’‘“”\-ـ]+/g, " ")
    .trim();

const normalizeUrl = (value = "") => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)) return `https://${url}`;
  return "";
};

const getDomainFromUrl = (value = "") => {
  const url = normalizeUrl(value);
  if (!url) return "";

  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const getDomainFromEmail = (value = "") => {
  const match = String(value || "").match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match ? match[1].replace(/^www\./, "").toLowerCase() : "";
};

const getFaviconUrl = (domain = "") => {
  const cleanDomain = String(domain || "").trim().replace(/^@/, "").replace(/^www\./, "");
  if (!cleanDomain || !cleanDomain.includes(".")) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    cleanDomain
  )}&sz=${LOGO_SIZE}`;
};

const curatedOrganizationDomains = {
  "اكوا باور": "acwapower.com",
  "اكاديميه التعلم": "aol.edu.sa",
  "اكاديمية التعلم": "aol.edu.sa",
  "امالا": "amaala.com",
  "ارامكو": "aramco.com",
  "اس تي سي": "stc.com.sa",
  "البحر الاحمر الدوليه": "redseaglobal.com",
  "البنك المركزي السعودي": "sama.gov.sa",
  "التامينات الاجتماعيه": "gosi.gov.sa",
  "الخطوط السعوديه": "saudia.com",
  "الرياض الماليه": "riyadcapital.com",
  "الشركه السعوديه للكهرباء": "se.com.sa",
  "القديه": "qiddiya.com",
  "اللجنه الاولمبيه والبارالمبيه السعوديه": "olympic.sa",
  "المركز الوطني للارصاد": "ncm.gov.sa",
  "المركز الوطني للتعليم الالكتروني": "nelc.gov.sa",
  "المركز الوطني لتنميه الغطاء النباتي": "ncvc.gov.sa",
  "المركز الوطني لتنميه الغطاء النباتي ومكافحه التصحر": "ncvc.gov.sa",
  "المركز الوطني للرقابه علي الالتزام البيئي": "ncec.gov.sa",
  "المجموعه السعوديه للابحاث والاعلام": "srmg.com",
  "المراعي": "almarai.com",
  "النيابه العامه": "pp.gov.sa",
  "الهيئه السعوديه للبيانات والذكاء الاصطناعي": "sdaia.gov.sa",
  "الهيئه السعوديه للسياحه": "sta.gov.sa",
  "الهيئه العامه للاذاعه والتلفزيون": "sba.sa",
  "الهيئه العامه للترفيه": "gea.gov.sa",
  "الهيئه العامه للغذاء والدواء": "sfda.gov.sa",
  "الهيئه العامه للمنافسه": "gac.gov.sa",
  "الهيئه العامه لتنظيم الاعلام": "gc.gov.sa",
  "الهيئه الملكيه للجبيل وينبع": "rcjy.gov.sa",
  "الهيئه الملكيه لمحافظه العلا": "rcu.gov.sa",
  "بوابه الدرعيه": "diriyah.sa",
  "بوبا العربيه": "bupa.com.sa",
  "تداول السعوديه": "saudiexchange.sa",
  "دله الصحيه": "dallah-health.com",
  "ديوان المظالم": "bog.gov.sa",
  "زين السعوديه": "sa.zain.com",
  "سابك": "sabic.com",
  "سدايا": "sdaia.gov.sa",
  "سفن": "sevencities.sa",
  "سنابل للاستثمار": "sanabil.com",
  "طيران ناس": "flynas.com",
  "علم": "elm.sa",
  "عزم الانجاز": "azmalenjaz.sa",
  "غرفه الرياض": "chamber.sa",
  "كاوست": "kaust.edu.sa",
  "كدانه": "kidana.com.sa",
  "كود لينك": "codelink.com.sa",
  "كود لينك لتقنيه المعلومات": "codelink.com.sa",
  "مجلس الضمان الصحي": "chi.gov.sa",
  "مجموعه الدكتور سليمان الحبيب": "hmg.com",
  "مجموعه صافولا": "savola.com",
  "مدينه الملك عبدالعزيز للعلوم والتقنيه": "kacst.gov.sa",
  "مستشفي الملك فيصل التخصصي": "kfshrc.edu.sa",
  "مؤسسه مسك": "misk.org.sa",
  "موبايلي": "mobily.com.sa",
  "موهبه": "mawhiba.org",
  "نادك": "nadec.com",
  "نيوم": "neom.com",
  "هيئه الادب والنشر والترجمه": "lpt.moc.gov.sa",
  "هيئه الاتصالات والفضاء والتقنيه": "cst.gov.sa",
  "هيئه الافلام": "film.moc.gov.sa",
  "هيئه التراث": "heritage.moc.gov.sa",
  "هيئه الحكومه الرقميه": "dga.gov.sa",
  "هيئه السوق الماليه": "cma.org.sa",
  "هيئه المساحه الجيولوجيه السعوديه": "sgs.gov.sa",
  "هيئه تطوير حائل": "hda.gov.sa",
  "هيئه تطوير عسير": "asda.gov.sa",
  "هيئه تطوير منطقه المدينه المنوره": "mda.gov.sa",
  "هيئه تقويم التعليم والتدريب": "etec.gov.sa",
  "هيئه حقوق الانسان": "hrc.gov.sa",
  "هيئه فنون العماره والتصميم": "archdesign.moc.gov.sa",
  "هيئه الفنون البصريه": "visualarts.moc.gov.sa",
  "وزاره الاتصالات وتقنيه المعلومات": "mcit.gov.sa",
  "وزاره الاعلام": "media.gov.sa",
  "وزاره البيئه والمياه والزراعه": "mewa.gov.sa",
  "وزاره التعليم": "moe.gov.sa",
  "وزاره الثقافه": "moc.gov.sa",
  "وزاره الخارجيه": "mofa.gov.sa",
  "وزاره الرياضه": "mos.gov.sa",
  "وزاره السياحه": "mt.gov.sa",
  "وزاره الصحه": "moh.gov.sa",
  "وزاره الطاقه": "moenergy.gov.sa",
  "وزاره العدل": "moj.gov.sa",
  "وزاره الماليه": "mof.gov.sa",
  "وزاره الموارد البشريه والتنميه الاجتماعيه": "hrsd.gov.sa",
  "وكاله الانباء السعوديه": "spa.gov.sa",
  "cma": "cma.org.sa",
  "deloitte": "deloitte.com",
  "elm": "elm.sa",
  "ey": "ey.com",
  "kpmg": "kpmg.com",
  "code link": "codelink.com.sa",
  "mbc": "mbc.net",
  "pwc": "pwc.com",
  "site": "site.sa",
  "stc": "stc.com.sa",
  "mos": "mos.gov.sa",
};

const isGenericLinkDomain = (domain = "") => {
  const cleanDomain = String(domain || "").replace(/^www\./, "").toLowerCase();
  return (
    GENERIC_LINK_DOMAINS.has(cleanDomain) ||
    cleanDomain.endsWith(".myworkdayjobs.com") ||
    cleanDomain.endsWith(".icims.com") ||
    cleanDomain.endsWith(".successfactors.com") ||
    cleanDomain.endsWith(".oraclecloud.com")
  );
};

const getFirstKnownDomain = (organization = {}) => {
  const directDomain =
    getDomainFromUrl(organization.logoUrl) ||
    getDomainFromUrl(organization.url) ||
    getDomainFromUrl(organization.sourceUrl) ||
    getDomainFromUrl(organization.applicationUrl);
  if (directDomain) return directDomain;

  const emails = [
    organization.email,
    organization.submitterContact,
    ...(organization.emails || []),
  ];

  return emails.map(getDomainFromEmail).find(Boolean) || "";
};

const buildGeneratedOrganizationDomains = () => {
  const map = {};

  [...darbakGuideOrganizations, ...darbakContactDirectoryOrganizations].forEach(
    (organization) => {
      const key = normalizeLogoKey(organization.name);
      const domain = getFirstKnownDomain(organization);
      if (key && domain && !map[key]) map[key] = domain;
    }
  );

  return map;
};

export const organizationLogoDomains = {
  ...buildGeneratedOrganizationDomains(),
  ...curatedOrganizationDomains,
};

const getKnownLogoDomain = (name = "") => {
  const normalizedName = normalizeLogoKey(name);
  if (!normalizedName) return "";

  if (organizationLogoDomains[normalizedName]) {
    return organizationLogoDomains[normalizedName];
  }

  const hasWholePhrase = (text = "", phrase = "") =>
    ` ${text} `.includes(` ${phrase} `);

  const matchingEntry = Object.entries(organizationLogoDomains)
    .filter(([key]) => key.length > 2)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => {
      if (hasWholePhrase(normalizedName, key)) return true;
      if (key.length <= 4 || normalizedName.length <= 4) return false;
      return normalizedName.includes(key) || key.includes(normalizedName);
    });

  return matchingEntry?.[1] || "";
};

const getValueArray = (value) => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

const addLogoCandidate = (candidates, value = "") => {
  const normalized = normalizeUrl(value);
  if (!normalized) return;

  if (IMAGE_URL_PATTERN.test(normalized) || normalized.includes("google.com/s2/favicons")) {
    candidates.push(normalized);
    return;
  }

  const domain = getDomainFromUrl(normalized);
  if (isGenericLinkDomain(domain)) return;

  const faviconUrl = getFaviconUrl(domain);
  if (faviconUrl) candidates.push(faviconUrl);
};

const addDirectLogoCandidate = (candidates, value = "") => {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return;
  if (rawUrl.startsWith("data:image/")) {
    candidates.push(rawUrl);
    return;
  }

  const normalized = normalizeUrl(rawUrl);
  if (normalized) candidates.push(normalized);
};

export const getOrganizationLogoCandidates = (entity = {}, extraCandidates = []) => {
  const candidates = [];
  const names = [
    entity.name,
    entity.organizationName,
    entity.companyName,
    entity.title,
  ].filter(Boolean);

  [
    entity.logoUrl,
    entity.logoURL,
    entity.imageUrl,
    entity.logo,
    entity.companyLogo,
    entity.companyLogoUrl,
    entity.organizationLogo,
    entity.organizationLogoUrl,
    ...getValueArray(entity.logoCandidates),
  ].forEach((value) => addDirectLogoCandidate(candidates, value));

  getValueArray(extraCandidates).forEach((value) => addLogoCandidate(candidates, value));

  names
    .map(getKnownLogoDomain)
    .filter(Boolean)
    .forEach((domain) => {
      const faviconUrl = getFaviconUrl(domain);
      if (faviconUrl) candidates.push(faviconUrl);
    });

  [
    entity.url,
    entity.website,
    entity.homepage,
    entity.sourceUrl,
    entity.applicationUrl,
    entity.careersUrl,
  ].forEach((value) => addLogoCandidate(candidates, value));

  [
    entity.email,
    entity.submitterContact,
    ...getValueArray(entity.emails),
  ].forEach((value) => {
    const faviconUrl = getFaviconUrl(getDomainFromEmail(value));
    if (faviconUrl) candidates.push(faviconUrl);
  });

  return Array.from(new Set(candidates));
};

export const getOrganizationLogoUrl = (entity = {}, extraCandidates = []) =>
  getOrganizationLogoCandidates(entity, extraCandidates)[0] || "";

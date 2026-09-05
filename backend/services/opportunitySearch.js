const normalizeOpportunitySearchText = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const synonymGroups = [
  ["تسويق", "التسويق", "marketing", "digital marketing", "market"],
  ["تقنيه معلومات", "تقنية معلومات", "it", "information technology"],
  ["علوم حاسب", "computer science", "cs"],
  ["نظم معلومات", "نظم المعلومات", "mis", "information systems"],
  ["محاسبه", "المحاسبه", "accounting", "accountant"],
  ["ماليه", "المالية", "finance", "financial"],
  ["موارد بشريه", "الموارد البشرية", "hr", "human resources"],
  ["تدريب", "تدريب تعاوني", "training", "coop", "co op", "cooperative"],
];

const cityGroups = [
  ["الرياض", "riyadh"],
  ["جده", "جدة", "jeddah"],
  ["مكه", "مكة", "makkah", "mecca"],
  ["المدينه المنوره", "المدينة المنورة", "المدينه", "المدينة", "madinah", "medina"],
  ["الدمام", "dammam"],
  ["الخبر", "khobar", "alkhobar"],
  ["الظهران", "dhahran"],
  ["القصيم", "qassim", "qaseem"],
  ["بريده", "بريدة", "buraydah", "buraidah"],
  ["جوبيل", "الجبيل", "jubail"],
  ["ابها", "أبها", "abha"],
  ["تبوك", "tabuk"],
  ["حايل", "حائل", "hail"],
  ["جازان", "jazan", "jizan"],
  ["نجران", "najran"],
];

const normalizedGroups = (groups) =>
  groups.map((group) => group.map(normalizeOpportunitySearchText));

const normalizedSynonymGroups = normalizedGroups(synonymGroups);
const normalizedCityGroups = normalizedGroups(cityGroups);

const includesPhrase = (text = "", phrase = "") => {
  if (!text || !phrase) return false;
  return ` ${text} `.includes(` ${phrase} `) || text.includes(phrase);
};

const getMatchingGroup = (term = "", groups = normalizedSynonymGroups) =>
  groups.find((group) =>
    group.some(
      (candidate) =>
        candidate === term || candidate.includes(term) || term.includes(candidate)
    )
  );

const getTermsForValue = (value = "") => {
  const normalizedValue = normalizeOpportunitySearchText(value);
  if (!normalizedValue) return [];

  const matchedGroup = getMatchingGroup(normalizedValue);
  return Array.from(new Set([normalizedValue, ...(matchedGroup || [])]));
};

const parseOpportunitySearchQuery = (query = "", explicitCity = "") => {
  const normalizedQuery = normalizeOpportunitySearchText(query);
  const normalizedExplicitCity = normalizeOpportunitySearchText(explicitCity);
  const cityGroup =
    normalizedCityGroups.find((group) =>
      group.some((city) => includesPhrase(normalizedQuery, city))
    ) || getMatchingGroup(normalizedExplicitCity, normalizedCityGroups);

  const detectedCity = cityGroup?.[0] || normalizedExplicitCity || "";
  const remainingQuery = cityGroup
    ? cityGroup.reduce(
        (current, city) => current.replace(new RegExp(`(^|\\s)${city}(?=\\s|$)`, "g"), " "),
        normalizedQuery
      )
    : normalizedQuery;
  const words = remainingQuery.split(/\s+/).filter(Boolean);
  const phraseCandidates = [remainingQuery, ...words].filter(Boolean);
  const conceptGroups = phraseCandidates
    .map((term) => getMatchingGroup(term))
    .filter(Boolean);
  const allTerms = Array.from(
    new Set(
      phraseCandidates.flatMap((term) => getTermsForValue(term)).filter(Boolean)
    )
  );

  return {
    query: normalizedQuery,
    city: detectedCity,
    terms: allTerms,
    concepts: Array.from(new Set(conceptGroups.map((group) => group.join("|")))).map(
      (key) => key.split("|")
    ),
  };
};

const opportunityFieldText = (opportunity = {}, fields = []) =>
  normalizeOpportunitySearchText(
    fields
      .flatMap((field) => {
        const value = opportunity[field];
        return Array.isArray(value) ? value : [value];
      })
      .filter(Boolean)
      .join(" ")
  );

const fieldMatchesTerms = (fieldText, terms = []) =>
  terms.some((term) => includesPhrase(fieldText, term));

const scoreOpportunitySearch = (opportunity = {}, parsedQuery = {}) => {
  if (!parsedQuery.query) return 0;

  const title = opportunityFieldText(opportunity, ["title"]);
  const company = opportunityFieldText(opportunity, ["organizationName"]);
  const major = opportunityFieldText(opportunity, ["specialties", "majorCategories"]);
  const details = opportunityFieldText(opportunity, ["note", "keywords", "skills"]);
  const type = opportunityFieldText(opportunity, ["applicationMethod", "programType", "type"]);
  const city = opportunityFieldText(opportunity, ["city", "cities"]);
  const allText = [title, company, major, details, type, city].join(" ");
  const { terms = [], concepts = [], query, city: searchedCity } = parsedQuery;

  let score = 0;
  if (includesPhrase(title, query)) score += 260;
  if (includesPhrase(company, query)) score += 190;

  concepts.forEach((concept) => {
    if (fieldMatchesTerms(title, concept)) score += 100;
    if (fieldMatchesTerms(company, concept)) score += 85;
    if (fieldMatchesTerms(major, concept)) score += 115;
    if (fieldMatchesTerms(details, concept)) score += 72;
    if (fieldMatchesTerms(type, concept)) score += 42;
  });

  terms.forEach((term) => {
    if (includesPhrase(title, term)) score += 44;
    if (includesPhrase(company, term)) score += 34;
    if (includesPhrase(major, term)) score += 48;
    if (includesPhrase(details, term)) score += 26;
    if (includesPhrase(type, term)) score += 16;
  });

  if (searchedCity && includesPhrase(city, searchedCity)) score += 95;
  if (terms.length && terms.every((term) => includesPhrase(allText, term))) score += 55;

  return score;
};

const rankOpportunitySearchResults = (opportunities = [], query = "", options = {}) => {
  const parsedQuery = parseOpportunitySearchQuery(query, options.city);
  const now = Date.now();

  return opportunities
    .map((opportunity) => {
      const relevance = scoreOpportunitySearch(opportunity, parsedQuery);
      const isOpen = opportunity.status === "active" &&
        (!opportunity.deadline || new Date(opportunity.deadline).getTime() >= now);
      const createdAt = new Date(opportunity.createdAt || 0).getTime() || 0;
      const ageDays = Math.max(0, (now - createdAt) / (24 * 60 * 60 * 1000));
      const freshness = Math.max(0, 14 - Math.min(14, ageDays)) / 14;
      return {
        opportunity,
        relevance,
        isOpen,
        score: relevance + (isOpen ? 35 : 0) + freshness * 10 + (opportunity.featured ? 3 : 0),
        createdAt,
      };
    })
    .filter(({ relevance }) => !parsedQuery.query || relevance > 0)
    .sort((left, right) =>
      Number(right.isOpen) - Number(left.isOpen) ||
      right.score - left.score ||
      right.createdAt - left.createdAt
    )
    .map(({ opportunity }) => opportunity);
};

module.exports = {
  synonymGroups,
  normalizeOpportunitySearchText,
  parseOpportunitySearchQuery,
  rankOpportunitySearchResults,
  scoreOpportunitySearch,
};

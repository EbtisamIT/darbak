const {
  DIRECTORY_COMPANY_SEEDS,
  companyAliasesMatchName,
  normalizeCompanyComparable,
} = require("./companyDirectorySeeds");

const slugifyCompanyName = (value = "") =>
  normalizeCompanyComparable(value)
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 110);

const findTrustedSeed = (suggestion = {}) => {
  const aliases = [suggestion.suggestedName, ...(suggestion.aliases || [])].filter(Boolean);
  return DIRECTORY_COMPANY_SEEDS.find((seed) =>
    aliases.some((alias) => companyAliasesMatchName({ ...seed, aliases: seed.aliases }, alias))
  );
};

const buildInternalSource = (suggestion = {}) => ({
  type: "darbak_content",
  label: `محتوى دربك: ${suggestion.experiencesCount || 0} تجربة، ${suggestion.interviewsCount || 0} مقابلة، ${suggestion.opportunitiesCount || 0} فرصة`,
  url: "",
});

const buildCompanyEnrichment = (suggestion = {}) => {
  const seed = findTrustedSeed(suggestion);
  const candidateAliases = Array.from(new Set(suggestion.aliases || [])).slice(0, 20);
  const aliases = Array.from(new Set(seed?.aliases || [])).slice(0, 20);
  const contentScore =
    Number(suggestion.experiencesCount || 0) +
    Number(suggestion.interviewsCount || 0) +
    Number(suggestion.opportunitiesCount || 0);

  if (seed) {
    return {
      name: seed.name,
      nameAr: seed.nameAr || seed.name,
      nameEn: seed.nameEn || "",
      slug: seed.slug,
      sector: seed.sector || "",
      website: seed.website || "",
      shortDescription: seed.shortDescription || "",
      aliases,
      suggestedAliases: candidateAliases.filter((alias) => !aliases.includes(alias)),
      confidence: "high",
      score: 92,
      sources: [
        { type: "official_website", label: "الموقع الرسمي", url: seed.website || "" },
        buildInternalSource(suggestion),
      ],
    };
  }

  const isAmbiguous = aliases.length > 5 || !suggestion.suggestedName;
  const confidence = isAmbiguous || contentScore < 2 ? "low" : "medium";
  return {
    name: suggestion.suggestedName || "جهة تحتاج مراجعة",
    nameAr: suggestion.suggestedName || "جهة تحتاج مراجعة",
    nameEn: "",
    slug: slugifyCompanyName(suggestion.suggestedName) || `company-${Date.now()}`,
    sector: "",
    website: "",
    shortDescription: "",
    aliases: [],
    suggestedAliases: candidateAliases,
    confidence,
    score: confidence === "medium" ? 64 : 34,
    sources: [buildInternalSource(suggestion)],
  };
};

const mergeAutoEnrichment = (company = {}, enrichment = {}) => {
  const provenance = company.fieldProvenance || {};
  const autoFields = ["name", "nameAr", "nameEn", "slug", "sector", "website", "shortDescription", "linkedinUrl"];
  const patch = {};
  const nextProvenance = { ...provenance };

  autoFields.forEach((field) => {
    if (provenance[field] !== "manual" && enrichment[field] !== undefined) {
      patch[field] = enrichment[field];
      nextProvenance[field] = "auto";
    }
  });
  if (provenance.aliases !== "manual") {
    patch.aliases = enrichment.aliases || [];
    patch.contentAliases = enrichment.aliases || [];
    nextProvenance.aliases = "auto";
  }
  if (provenance.suggestedAliases !== "manual") {
    patch.suggestedAliases = enrichment.suggestedAliases || [];
    nextProvenance.suggestedAliases = "auto";
  }

  return {
    ...patch,
    fieldProvenance: nextProvenance,
    enrichmentStatus: "draft",
    enrichment: {
      confidence: enrichment.confidence,
      score: enrichment.score,
      sources: enrichment.sources || [],
      lastEnrichedAt: new Date(),
    },
  };
};

module.exports = {
  buildCompanyEnrichment,
  mergeAutoEnrichment,
  slugifyCompanyName,
};

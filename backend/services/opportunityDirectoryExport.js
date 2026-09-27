const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const toText = (value = "") => String(value || "").trim();
const toList = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [value])
        .map(toText)
        .filter(Boolean)
    )
  );
const toIso = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};
const uniqueEmails = (...values) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => toText(value).match(EMAIL_PATTERN) || [])
        .map((email) => email.toLowerCase())
    )
  );

const getCities = (item = {}, fallbackCity = "") =>
  toList([...(item.cities || []), item.city, fallbackCity]);

const getSpecialties = (item = {}) =>
  toList([...(item.specialties || []), ...(item.majorCategories || [])]);

const getSource = (item = {}) => {
  const sources = item.enrichment?.sources || [];
  return {
    type: toText(item.sourceType) || (sources.length ? "enriched" : "manual"),
    url: toText(item.sourceUrl) || toText(sources[0]?.url),
  };
};

const flattenForCsv = (value) => (Array.isArray(value) ? value.join(" | ") : value || "");

const buildOpportunityDirectoryExport = ({
  companies = [],
  opportunities = [],
  companySuggestions = [],
} = {}) => {
  const companyById = new Map(companies.map((company) => [String(company._id), company]));
  const companyRows = companies.map((company) => {
    const source = getSource(company);
    return {
      recordType: "company",
      id: String(company._id),
      companyId: String(company._id),
      name: toText(company.nameAr) || toText(company.name) || toText(company.nameEn),
      nameAr: toText(company.nameAr),
      nameEn: toText(company.nameEn),
      specialties: [],
      cities: getCities(company),
      emails: uniqueEmails(company.contactEmail),
      applicationChannel: "",
      applicationUrl: "",
      logoUrl: toText(company.logoUrl),
      website: toText(company.website),
      sourceType: source.type,
      sourceUrl: source.url,
      status: toText(company.status),
      createdAt: toIso(company.createdAt),
      updatedAt: toIso(company.updatedAt),
      deadline: "",
    };
  });

  const opportunityRows = opportunities.map((opportunity) => {
    const company = opportunity.companyId ? companyById.get(String(opportunity.companyId)) : null;
    const source = getSource(opportunity);
    const applicationEmails = uniqueEmails(opportunity.applicationUrl);
    const companyEmails = uniqueEmails(company?.contactEmail);
    return {
      recordType: "opportunity",
      id: String(opportunity._id),
      companyId: company ? String(company._id) : "",
      name: toText(opportunity.organizationName) || toText(company?.name),
      nameAr: toText(company?.nameAr),
      nameEn: toText(company?.nameEn),
      title: toText(opportunity.title),
      specialties: getSpecialties(opportunity),
      cities: getCities(opportunity, company?.city),
      emails: Array.from(new Set([...applicationEmails, ...companyEmails])),
      applicationChannel: toText(opportunity.applicationMethod),
      applicationUrl: toText(opportunity.applicationUrl),
      logoUrl: toText(opportunity.logoUrl) || toText(company?.logoUrl),
      website: toText(company?.website),
      sourceType: source.type,
      sourceUrl: source.url,
      status: toText(opportunity.status),
      createdAt: toIso(opportunity.createdAt),
      updatedAt: toIso(opportunity.updatedAt),
      deadline: toIso(opportunity.deadline),
    };
  });

  const companySuggestionRows = companySuggestions
    .filter((suggestion) => !suggestion.company)
    .map((suggestion) => ({
      recordType: "company_suggestion",
      id: toText(suggestion.key),
      companyId: "",
      name: toText(suggestion.suggestedName),
      nameAr: "",
      nameEn: "",
      title: "",
      specialties: [],
      cities: [],
      emails: [],
      applicationChannel: "",
      applicationUrl: "",
      logoUrl: "",
      website: "",
      sourceType: "content_suggestion",
      sourceUrl: "",
      status: "suggested",
      createdAt: "",
      updatedAt: "",
      deadline: "",
      aliases: toList(suggestion.aliases),
      experiencesCount: Number(suggestion.experiencesCount || 0),
      interviewsCount: Number(suggestion.interviewsCount || 0),
      opportunitiesCount: Number(suggestion.opportunitiesCount || 0),
    }));

  const coverage = new Map();
  opportunityRows
    .filter((row) => row.status === "active" && row.emails.length > 0)
    .forEach((row) => {
      const specialties = row.specialties.length ? row.specialties : ["غير محدد"];
      const cities = row.cities.length ? row.cities : ["غير محدد"];
      const entityKey = row.companyId || `name:${row.name.toLowerCase()}`;
      specialties.forEach((specialty) => cities.forEach((city) => {
        const key = `${specialty}\u0000${city}`;
        if (!coverage.has(key)) {
          coverage.set(key, {
            specialty,
            city,
            eligibleCompanyIds: new Set(),
            eligibleOpportunityIds: new Set(),
          });
        }
        const item = coverage.get(key);
        item.eligibleCompanyIds.add(entityKey);
        item.eligibleOpportunityIds.add(row.id);
      }));
    });

  const emailEligibleCoverage = Array.from(coverage.values())
    .map((item) => ({
      specialty: item.specialty,
      city: item.city,
      eligibleCompanyCount: item.eligibleCompanyIds.size,
      eligibleOpportunityCount: item.eligibleOpportunityIds.size,
    }))
    .sort((a, b) =>
      b.eligibleCompanyCount - a.eligibleCompanyCount ||
      a.specialty.localeCompare(b.specialty, "ar") ||
      a.city.localeCompare(b.city, "ar")
    );

  return {
    generatedAt: new Date().toISOString(),
    companies: companyRows,
    opportunities: opportunityRows,
    companySuggestions: companySuggestionRows,
    emailEligibleCoverage,
  };
};

const buildDirectoryCsvRows = (exportData, view = "records") => {
  if (view === "coverage") {
    return [
      ["Specialty", "City", "Eligible company count", "Eligible opportunity count"],
      ...exportData.emailEligibleCoverage.map((item) => [
        item.specialty,
        item.city,
        item.eligibleCompanyCount,
        item.eligibleOpportunityCount,
      ]),
    ];
  }

  const fields = [
    "recordType", "id", "companyId", "name", "nameAr", "nameEn", "title",
    "specialties", "cities", "emails", "applicationChannel", "applicationUrl",
    "logoUrl", "website", "sourceType", "sourceUrl", "status", "createdAt",
    "updatedAt", "deadline", "aliases", "experiencesCount", "interviewsCount",
    "opportunitiesCount",
  ];
  return [
    fields,
    ...[
      ...exportData.companies,
      ...exportData.opportunities,
      ...exportData.companySuggestions,
    ].map((row) =>
      fields.map((field) => flattenForCsv(row[field]))
    ),
  ];
};

module.exports = {
  buildOpportunityDirectoryExport,
  buildDirectoryCsvRows,
};

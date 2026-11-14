import { SITE_ORIGIN, toCanonicalUrl } from "./seoPages.mjs";

export { SITE_ORIGIN };

export const getCompanySeo = (company = {}, overview = {}) => {
  const name = company.nameAr || company.name || company.nameEn || "جهة التدريب";
  const experiences = Number(overview.experiencesCount || 0);
  const interviews = Number(overview.interviewsCount || 0);
  const openOpportunities = Number(overview.openOpportunitiesCount || 0);
  const parts = [];
  if (experiences) parts.push(`${experiences} تجربة تدريب`);
  if (interviews) parts.push("مراجعات مقابلات");
  if (openOpportunities) parts.push("الفرص الحالية");
  return {
    name,
    title: `التدريب في ${name} | التجارب والمقابلات والفرص`,
    description: parts.length
      ? `استعرض ${parts.join(" و")} المرتبطة بـ ${name} في دربك، مع التخصصات والمدن التي شاركها الطلاب.`
      : `استعرض تجارب التدريب والمقابلات والفرص المرتبطة بـ ${name} في دربك.`,
    path: `/companies/${company.slug}`,
  };
};

export const buildCompanyStructuredData = (company = {}, overview = {}) => {
  const seo = getCompanySeo(company, overview);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: seo.name,
        alternateName: (company.aliases || []).slice(0, 8),
        url: toCanonicalUrl(seo.path),
        ...(company.logoUrl ? { logo: company.logoUrl } : {}),
        ...(company.website ? { sameAs: [company.website, company.linkedinUrl].filter(Boolean) } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "دربك", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "الشركات", item: `${SITE_ORIGIN}/companies` },
          { "@type": "ListItem", position: 3, name: seo.name, item: toCanonicalUrl(seo.path) },
        ],
      },
    ],
  };
};

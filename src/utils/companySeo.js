import { setPageSeo } from "./seoMetadata";

export const getCompanySeo = (company = {}, overview = {}) => {
  const name = company.nameAr || company.name || company.nameEn || "جهة التدريب";
  const experiences = Number(overview.experiencesCount || 0);
  const interviews = Number(overview.interviewsCount || 0);
  const openOpportunities = Number(overview.openOpportunitiesCount || 0);
  const parts = [];
  if (experiences) parts.push(`${experiences} تجربة تدريب`);
  if (interviews) parts.push("مراجعات مقابلات");
  if (openOpportunities) parts.push("الفرص الحالية");
  const description = parts.length
    ? `استعرض ${parts.join(" و")} المرتبطة بـ ${name} في دربك، مع التخصصات والمدن التي شاركها الطلاب.`
    : `استعرض تجارب التدريب والمقابلات والفرص المرتبطة بـ ${name} في دربك.`;
  return {
    name,
    title: `التدريب في ${name} | التجارب والمقابلات والفرص`,
    description,
    path: `/companies/${company.slug}`,
  };
};

export const setCompanySeo = (company, overview) => {
  const seo = getCompanySeo(company, overview);
  setPageSeo(seo);
  const id = "company-json-ld";
  document.getElementById(id)?.remove();
  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: seo.name,
        alternateName: (company.aliases || []).slice(0, 8),
        url: `https://darbak.space${seo.path}`,
        ...(company.logoUrl ? { logo: company.logoUrl } : {}),
        ...(company.website ? { sameAs: [company.website, company.linkedinUrl].filter(Boolean) } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "دربك", item: "https://darbak.space/" },
          { "@type": "ListItem", position: 2, name: "الشركات", item: "https://darbak.space/companies" },
          { "@type": "ListItem", position: 3, name: seo.name, item: `https://darbak.space${seo.path}` },
        ],
      },
    ],
  });
  document.head.appendChild(script);
  return () => script.remove();
};

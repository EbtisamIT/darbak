import { setPageSeo } from "./seoMetadata";
const { getCompanySeo, buildCompanyStructuredData } = require("./companySeoData");

export { getCompanySeo };

export const setCompanySeo = (company, overview) => {
  const seo = getCompanySeo(company, overview);
  setPageSeo(seo);
  const id = "company-json-ld";
  document.getElementById(id)?.remove();
  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify(buildCompanyStructuredData(company, overview));
  document.head.appendChild(script);
  return () => script.remove();
};

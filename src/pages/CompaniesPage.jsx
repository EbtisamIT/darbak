import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import API_BASE_URL from "../config/api";
import { getOrganizationLogoUrl } from "../data/organizationLogos";
import { trackEvent } from "../utils/analytics";
import "./CompaniesPage.css";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE_URL}/api/companies`)
      .then(({ data }) => {
        if (active) setCompanies(Array.isArray(data?.data) ? data.data : []);
      })
      .catch(() => {
        if (active) setCompanies([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    trackEvent("company_directory_viewed");
    return () => { active = false; };
  }, []);

  return (
    <main className="companies-page" dir="rtl">
      <section className="companies-intro">
        <span>جهات التدريب</span>
        <h1>استكشف الجهات في دربك</h1>
        <p>تجارب ومقابلات وفرص مجمعة لكل جهة في مكان واحد.</p>
      </section>

      <section className="companies-grid" aria-label="الشركات المتاحة">
        {companies.map((company) => {
          const logoUrl = company.logoUrl || getOrganizationLogoUrl({ name: company.name, url: company.website });
          return (
            <Link
              key={company.id || company.slug}
              className="company-directory-card"
              to={`/companies/${company.slug}`}
              onClick={() => trackEvent("company_directory_company_opened", { metadata: { companySlug: company.slug, companyName: company.name } })}
            >
              <span className="company-directory-logo" aria-hidden="true">
                {logoUrl ? <img src={logoUrl} alt="" /> : company.name.slice(0, 1)}
              </span>
              <span className="company-directory-content">
                <strong>{company.name}</strong>
                <small>{company.shortDescription || "تجارب ومقابلات وفرص تدريب"}</small>
              </span>
              <FiArrowLeft className="company-directory-arrow" aria-hidden="true" />
            </Link>
          );
        })}
        {!loading && companies.length === 0 ? <div className="company-content-empty">لا توجد جهات مضافة للدليل حاليًا.</div> : null}
        {loading ? <div className="company-content-state">جارِ تحميل الجهات...</div> : null}
      </section>
    </main>
  );
}

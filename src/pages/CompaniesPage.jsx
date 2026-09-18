import React, { useEffect, useMemo, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyInterviews, setOnlyInterviews] = useState(false);

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

  const sectors = useMemo(() => Array.from(new Set(companies.map((company) => company.sector).filter(Boolean))).sort(), [companies]);
  const visibleCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return companies.filter((company) => {
      const names = [company.name, company.nameAr, company.nameEn, ...(company.aliases || [])].join(" ").toLocaleLowerCase("ar");
      return (!normalizedQuery || names.includes(normalizedQuery)) &&
        (!sector || company.sector === sector) &&
        (!onlyOpen || Number(company.openOpportunitiesCount) > 0) &&
        (!onlyInterviews || Number(company.interviewsCount) > 0);
    }).sort((left, right) => Number(right.experiencesCount || 0) - Number(left.experiencesCount || 0));
  }, [companies, query, sector, onlyOpen, onlyInterviews]);

  return (
    <main className="companies-page" dir="rtl">
      <section className="companies-intro">
        <span>جهات التدريب</span>
        <h1>استكشف الجهات في دربك</h1>
        <p>تجارب ومقابلات وفرص مجمعة لكل جهة في مكان واحد.</p>
      </section>

      <section className="companies-filters" aria-label="بحث وفلاتر الجهات">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم جهة أو اسم بديل..." />
        <select value={sector} onChange={(event) => setSector(event.target.value)}><option value="">كل القطاعات</option>{sectors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <label><input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} /> عليها فرص مفتوحة</label>
        <label><input type="checkbox" checked={onlyInterviews} onChange={(event) => setOnlyInterviews(event.target.checked)} /> مقابلات متوفرة</label>
      </section>

      <section className="companies-grid" aria-label="الشركات المتاحة">
        {visibleCompanies.map((company) => {
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
                <small>{company.sector || company.shortDescription || "جهة تدريب"}</small>
                <em className="company-directory-badges">
                  {Number(company.openOpportunitiesCount) > 0 && <b>فرص مفتوحة</b>}
                  {Number(company.experiencesCount) > 0 && <b>{company.experiencesCount} تجربة</b>}
                  {Number(company.interviewsCount) > 0 && <b>مقابلات</b>}
                </em>
              </span>
              <FiArrowLeft className="company-directory-arrow" aria-hidden="true" />
            </Link>
          );
        })}
        {!loading && companies.length === 0 ? <div className="company-content-empty">لا توجد جهات مضافة للدليل حاليًا.</div> : null}
        {!loading && companies.length > 0 && visibleCompanies.length === 0 ? <div className="company-content-empty">ما لقينا جهة مطابقة. جرّبي اسمًا آخر أو أزيلي أحد الفلاتر.</div> : null}
        {loading ? <div className="company-content-state">جارِ تحميل الجهات...</div> : null}
      </section>
    </main>
  );
}

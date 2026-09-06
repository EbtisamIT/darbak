import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useParams, useSearchParams } from "react-router-dom";
import API_BASE_URL from "../config/api";
import CompanyPortalThemeToggle from "../components/CompanyPortalThemeToggle";

const CompanyProgramOverviewPage = ({ theme, setTheme }) => {
  const { companySlug = "", programId = "" } = useParams();
  const [params] = useSearchParams();
  const access = params.get("access") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const response = await axios.get(`${API_BASE_URL}/api/company-portal/${encodeURIComponent(companySlug)}/program/${encodeURIComponent(programId)}`, { params: { access } }); setData(response.data); }
    catch (requestError) { setError(requestError.response?.data?.error || "تعذر تحميل البرنامج."); }
  }, [access, companySlug, programId]);
  useEffect(() => { load(); }, [load]);
  if (error) return <main className="company-share-page" dir="rtl"><div className="company-share-state company-share-error"><p>{error}</p></div></main>;
  if (!data) return <main className="company-share-page" dir="rtl"><div className="company-share-state">جار التحميل...</div></main>;
  const { company, program, lastApplicants = [] } = data;
  return <main className="company-share-page" dir="rtl"><section className="company-share-shell"><header className="company-share-header"><Link to={`/company/${company.slug}?access=${encodeURIComponent(access)}`}>العودة للبرامج</Link><div className="company-portal-header-actions"><CompanyPortalThemeToggle theme={theme} setTheme={setTheme} /><div className="company-share-brand">دربك</div></div></header><section className="company-share-hero"><span className="company-share-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : company.name.charAt(0)}</span><div><p>{company.name}</p><h1>{program.opportunityTitle}</h1><h2>{program.status}</h2></div><strong className="company-share-count">{program.applicationCount}<small>متقدم</small></strong></section><section className="company-share-controls"><a className="company-share-export" href={program.applyUrl} target="_blank" rel="noreferrer">فتح رابط التقديم</a>{program.applicationsShareUrl && <a className="company-share-cv" href={program.applicationsShareUrl} target="_blank" rel="noreferrer">عرض كل المتقدمين</a>}</section><section className="company-share-table-wrap"><h2>آخر المتقدمين</h2><table className="company-share-table"><thead><tr><th>الاسم</th><th>التخصص</th><th>الجامعة</th><th>التاريخ</th></tr></thead><tbody>{lastApplicants.map((item, index) => <tr key={`${item.fullName}-${index}`}><td>{item.fullName}</td><td>{item.major || "-"}</td><td>{item.university || "-"}</td><td>{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("ar-SA") : "-"}</td></tr>)}</tbody></table>{!lastApplicants.length && <p className="company-share-empty">لا توجد طلبات حتى الآن.</p>}</section></section></main>;
};
export default CompanyProgramOverviewPage;

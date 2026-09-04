import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import API_BASE_URL from "../config/api";

const pageFont = "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif";

const formatDate = (value) => {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);
};

const CompanyLogo = ({ src, name }) => {
  const [failed, setFailed] = useState(false);
  const initial = (name || "د").trim().charAt(0) || "د";
  return (
    <span className="company-share-logo">
      {src && !failed ? (
        <img src={src} alt={`شعار ${name}`} onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </span>
  );
};

const CompanyApplicationsSharePage = () => {
  const { shareToken = "" } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [major, setMajor] = useState("");
  const [university, setUniversity] = useState("");

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: response } = await axios.get(
        `${API_BASE_URL}/api/company-applications/share/${encodeURIComponent(shareToken)}`,
        { params: { search, major, university } }
      );
      setData(response);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "تعذر تحميل طلبات البرنامج الآن."
      );
    } finally {
      setLoading(false);
    }
  }, [major, search, shareToken, university]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    const previous = meta?.getAttribute("content") || "";
    if (meta) meta.setAttribute("content", "noindex, nofollow, noarchive");
    else {
      const created = document.createElement("meta");
      created.name = "robots";
      created.content = "noindex, nofollow, noarchive";
      document.head.appendChild(created);
    }
    return () => {
      const current = document.querySelector('meta[name="robots"]');
      if (current && previous) current.setAttribute("content", previous);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchApplications, 180);
    return () => window.clearTimeout(timer);
  }, [fetchApplications]);

  useEffect(() => {
    if (data?.campaign?.organizationName) {
      document.title = `طلبات ${data.campaign.organizationName} | دربك`;
    }
  }, [data]);

  const exportUrl = useMemo(
    () =>
      `${API_BASE_URL}/api/company-applications/share/${encodeURIComponent(
        shareToken
      )}/export`,
    [shareToken]
  );
  const applications = Array.isArray(data?.applications) ? data.applications : [];
  const campaign = data?.campaign || {};

  return (
    <main className="company-share-page" dir="rtl" style={{ fontFamily: pageFont }}>
      <section className="company-share-shell">
        <header className="company-share-header">
          <div className="company-share-brand">دربك</div>
          <span>مراجعة طلبات خاصة</span>
        </header>

        {loading && !data ? (
          <section className="company-share-state">جار تحميل طلبات المتقدمين...</section>
        ) : error ? (
          <section className="company-share-state company-share-error">
            <h1>تعذر فتح الصفحة</h1>
            <p>{error}</p>
          </section>
        ) : (
          <>
            <section className="company-share-hero">
              <CompanyLogo
                src={campaign.organizationLogoUrl}
                name={campaign.organizationName}
              />
              <div>
                <p>طلبات التقديم عبر دربك</p>
                <h1>{campaign.organizationName}</h1>
                <h2>{campaign.opportunityTitle}</h2>
              </div>
              <strong className="company-share-count">
                {Number(data?.applicationCount || 0)}
                <small>متقدم</small>
              </strong>
            </section>

            <section className="company-share-controls" aria-label="تصفية المتقدمين">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ابحث بالاسم أو البريد أو التخصص"
              />
              <select value={major} onChange={(event) => setMajor(event.target.value)}>
                <option value="">كل التخصصات</option>
                {(data?.filters?.majors || []).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select value={university} onChange={(event) => setUniversity(event.target.value)}>
                <option value="">كل الجامعات</option>
                {(data?.filters?.universities || []).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <a href={exportUrl} className="company-share-export">تصدير CSV</a>
            </section>

            <section className="company-share-table-wrap">
              {loading && <div className="company-share-table-loading">جار التحديث...</div>}
              <table className="company-share-table">
                <thead>
                  <tr>
                    <th>الاسم</th><th>التخصص</th><th>الجامعة</th><th>المدينة</th><th>تاريخ التقديم</th><th>السيرة الذاتية</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <strong>{application.fullName}</strong>
                        <small>{application.email}</small>
                        <small dir="ltr">{application.phone}</small>
                      </td>
                      <td>{application.major || "-"}</td>
                      <td>{application.university || "-"}</td>
                      <td>{application.city || "-"}</td>
                      <td>{formatDate(application.submittedAt)}</td>
                      <td>
                        {application.cvUrl ? (
                          <a href={application.cvUrl} target="_blank" rel="noreferrer" className="company-share-cv">عرض السيرة</a>
                        ) : "-"}
                        {application.linkedinUrl && (
                          <a href={application.linkedinUrl} target="_blank" rel="noreferrer" className="company-share-linkedin">LinkedIn</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!applications.length && !loading && (
                <p className="company-share-empty">لا توجد طلبات مطابقة لهذا البحث حتى الآن.</p>
              )}
            </section>
            <p className="company-share-privacy">هذه الصفحة مخصصة لمراجعة طلبات المتقدمين على البرنامج، والبيانات تستخدم لغرض التوظيف أو التدريب فقط.</p>
          </>
        )}
      </section>
    </main>
  );
};

export default CompanyApplicationsSharePage;

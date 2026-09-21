import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import API_BASE_URL from "../config/api";

const pageFont = "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif";

const applicationStatuses = [
  ["submitted", "تم التقديم"],
  ["under_review", "قيد المراجعة"],
  ["shortlisted", "مرشح"],
  ["interview", "مقابلة"],
  ["accepted", "مقبول"],
  ["rejected", "مرفوض"],
];

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
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("under_review");
  const [savingIds, setSavingIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [savingOutcome, setSavingOutcome] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: response } = await axios.get(
        `${API_BASE_URL}/api/company-applications/share/${encodeURIComponent(shareToken)}`,
        { params: { search, major, university, page, limit: 50 } }
      );
      setData(response);
      setSelectedIds([]);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error || "تعذر تحميل طلبات البرنامج الآن."
      );
    } finally {
      setLoading(false);
    }
  }, [major, page, search, shareToken, university]);

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
  const statusSummary = data?.statusSummary || campaign.statusSummary || {};
  const pagination = data?.pagination || { page: 1, total: applications.length, limit: 50 };

  const updateLocalApplications = (updated = []) => {
    const byId = new Map(updated.map((item) => [item.id || item._id, item]));
    setData((current) => ({
      ...current,
      applications: (current?.applications || []).map((item) =>
        byId.get(item.id || item._id) || item
      ),
    }));
  };

  const updateStatus = async (applicationIds, status) => {
    const ids = Array.from(new Set(applicationIds)).filter(Boolean);
    if (!ids.length) return;
    setSavingIds(ids);
    setNotice("");
    try {
      const endpoint = ids.length === 1
        ? `${API_BASE_URL}/api/company-applications/share/${encodeURIComponent(shareToken)}/applications/${encodeURIComponent(ids[0])}/status`
        : `${API_BASE_URL}/api/company-applications/share/${encodeURIComponent(shareToken)}/applications/status`;
      const payload = ids.length === 1 ? { status } : { status, applicationIds: ids };
      const { data: response } = await axios.patch(endpoint, payload);
      updateLocalApplications(response.data || []);
      setSelectedIds([]);
      setNotice(response.changedCount
        ? `تم تحديث ${response.changedCount} من الطلبات.`
        : "هذه الطلبات تحمل الحالة نفسها بالفعل.");
      await fetchApplications();
    } catch (requestError) {
      setNotice(requestError.response?.data?.error || "تعذر تحديث حالة الطلب.");
    } finally {
      setSavingIds([]);
    }
  };

  const saveOutcome = async (outcomeStatus) => {
    if (outcomeStatus === "selected" && !selectedIds.length) {
      setNotice("حدد المقبولين من الجدول أولًا.");
      return;
    }
    setSavingOutcome(true);
    setNotice("");
    try {
      await axios.patch(
        `${API_BASE_URL}/api/company-applications/share/${encodeURIComponent(shareToken)}/outcome`,
        { outcomeStatus, selectedApplicationIds: outcomeStatus === "selected" ? selectedIds : [] }
      );
      setNotice("تم حفظ نتيجة البرنامج.");
      await fetchApplications();
    } catch (requestError) {
      setNotice(requestError.response?.data?.error || "تعذر حفظ نتيجة البرنامج.");
    } finally {
      setSavingOutcome(false);
    }
  };

  const downloadCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const response = await axios.get(exportUrl, { responseType: "blob" });
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "darbak-applications.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError("تعذر إنشاء ملف CSV الآن. حاول مرة أخرى.");
    } finally {
      setExporting(false);
    }
  };

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

            <section className="company-applications-summary" aria-label="ملخص حالات المتقدمين">
              {[
                ["إجمالي المتقدمين", statusSummary.total ?? data?.applicationCount ?? 0],
                ["جديد", statusSummary.submitted || 0],
                ["قيد المراجعة", statusSummary.under_review || 0],
                ["مرشح", statusSummary.shortlisted || 0],
                ["مقابلة", statusSummary.interview || 0],
                ["مقبول", statusSummary.accepted || 0],
                ["مرفوض", statusSummary.rejected || 0],
              ].map(([label, value]) => (
                <div key={label}><strong>{Number(value || 0)}</strong><span>{label}</span></div>
              ))}
            </section>

            {notice && <p className="company-share-privacy">{notice}</p>}

            <section className="company-share-controls" aria-label="تصفية المتقدمين">
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="ابحث بالاسم أو البريد أو التخصص"
              />
              <select value={major} onChange={(event) => { setMajor(event.target.value); setPage(1); }}>
                <option value="">كل التخصصات</option>
                {(data?.filters?.majors || []).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select value={university} onChange={(event) => { setUniversity(event.target.value); setPage(1); }}>
                <option value="">كل الجامعات</option>
                {(data?.filters?.universities || []).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <button
                type="button"
                className="company-share-export"
                onClick={downloadCsv}
                disabled={exporting}
              >
                {exporting ? "جار تجهيز الملف..." : "تصدير CSV"}
              </button>
            </section>

            <section className="company-applications-bulk" aria-label="إجراءات الطلبات المحددة">
              <strong>{selectedIds.length ? `تم تحديد ${selectedIds.length}` : "حدد المتقدمين لتحديثهم معًا"}</strong>
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
                {applicationStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" disabled={!selectedIds.length || savingIds.length > 0} onClick={() => updateStatus(selectedIds, bulkStatus)}>
                {savingIds.length ? "جارٍ الحفظ..." : "تغيير حالة المحددين"}
              </button>
            </section>

            <section className="company-share-table-wrap">
              {loading && <div className="company-share-table-loading">جار التحديث...</div>}
              <table className="company-share-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="تحديد كل الطلبات الظاهرة" checked={applications.length > 0 && selectedIds.length === applications.length} onChange={(event) => setSelectedIds(event.target.checked ? applications.map((item) => item.id || item._id) : [])} /></th><th>الاسم</th><th>التخصص</th><th>الجامعة</th><th>المدينة</th><th>تاريخ التقديم</th><th>السيرة الذاتية</th><th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td><input type="checkbox" aria-label={`تحديد ${application.fullName}`} checked={selectedIds.includes(application.id || application._id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, application.id || application._id] : current.filter((id) => id !== (application.id || application._id)))} /></td>
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
                      <td>
                        <select aria-label={`حالة طلب ${application.fullName}`} value={application.status || "submitted"} disabled={savingIds.includes(application.id || application._id)} onChange={(event) => updateStatus([application.id || application._id], event.target.value)}>
                          {applicationStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!applications.length && !loading && (
                <p className="company-share-empty">لا توجد طلبات مطابقة لهذا البحث حتى الآن.</p>
              )}
            </section>
            {pagination.total > pagination.limit && <nav className="company-applications-pagination" aria-label="صفحات المتقدمين">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>السابق</button>
              <span>صفحة {pagination.page} من {Math.ceil(pagination.total / pagination.limit)}</span>
              <button type="button" disabled={page >= Math.ceil(pagination.total / pagination.limit)} onClick={() => setPage((value) => value + 1)}>التالي</button>
            </nav>}

            {campaign.isEnded && Number(data?.applicationCount || 0) > 0 && <section className="company-campaign-outcome">
              <h2>انتهى استقبال الطلبات</h2>
              <p>استقبلتم {Number(data?.applicationCount || 0)} طلبًا عبر دربك. هل تم اختيار أي متدرب من المتقدمين؟</p>
              <div>
                <button type="button" disabled={savingOutcome} onClick={() => saveOutcome("selected")}>نعم، تم اختيار المحددين</button>
                <button type="button" disabled={savingOutcome} onClick={() => saveOutcome("reviewing")}>ما زلنا نراجع الطلبات</button>
                <button type="button" disabled={savingOutcome} onClick={() => saveOutcome("none_selected")}>لم يتم اختيار أحد</button>
              </div>
              <small>النتيجة الحالية: {campaign.outcomeStatus === "selected" ? "تم الاختيار" : campaign.outcomeStatus === "reviewing" ? "قيد المراجعة" : campaign.outcomeStatus === "none_selected" ? "لم يتم اختيار أحد" : "بانتظار التحديث"}</small>
            </section>}
            <p className="company-share-privacy">هذه الصفحة مخصصة لمراجعة طلبات المتقدمين على البرنامج، والبيانات تستخدم لغرض التوظيف أو التدريب فقط.</p>
          </>
        )}
      </section>
    </main>
  );
};

export default CompanyApplicationsSharePage;

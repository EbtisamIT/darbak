import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import API_BASE_URL from "../config/api";

const font = "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif";

const statusLabels = {
  new: "جديد",
  reviewing: "قيد المراجعة",
  shortlisted: "مرشح",
  interview: "مقابلة",
  accepted: "مقبول",
  rejected: "مرفوض",
};

const programLabels = {
  demo: "تجريبي - للعرض فقط",
  draft: "مسودة",
  pending_review: "بانتظار مراجعة دربك",
  changes_requested: "مطلوب تعديل",
  open: "مفتوح",
  closed: "مغلق",
  rejected: "مرفوض",
};

const demoStatuses = ["new", "reviewing", "shortlisted", "interview", "accepted", "rejected"];

const CompanyPortalPage = () => {
  const { companySlug = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const access = searchParams.get("access") || "";
  const activeTab = searchParams.get("tab") || "overview";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "", city: "", majors: "", description: "", requirements: "", endDate: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedDemoApplicant, setSelectedDemoApplicant] = useState(null);
  const [demoStatus, setDemoStatus] = useState("new");
  const [endingDemo, setEndingDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/company-portal/${encodeURIComponent(companySlug)}`, { params: { access } });
      setData(response.data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر فتح بوابة الشركة.");
    } finally {
      setLoading(false);
    }
  }, [access, companySlug]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    const previous = meta?.content || "";
    if (meta) meta.content = "noindex, nofollow, noarchive";
    return () => { if (meta) meta.content = previous; };
  }, []);
  useEffect(() => {
    const demoApplicant = data?.latestApplicants?.find((item) => item.isDemo);
    setDemoStatus(demoApplicant?.status || "new");
  }, [data]);

  const setPortalTab = (tab) => {
    const params = new URLSearchParams();
    if (access) params.set("access", access);
    if (tab && tab !== "overview") params.set("tab", tab);
    navigate(`/company/${companySlug}?${params.toString()}`);
    if (tab === "request") setFormOpen(true);
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await axios.post(`${API_BASE_URL}/api/company-portal/${encodeURIComponent(companySlug)}/requests`, {
        title: form.title,
        type: form.type,
        city: form.city,
        specialties: form.majors.split(",").map((item) => item.trim()).filter(Boolean),
        description: form.description,
        requirements: form.requirements,
        applicationDeadline: form.endDate,
        endDate: form.endDate,
      }, { params: { access } });
      setNotice("تم إرسال الفرصة إلى دربك، وهي الآن بانتظار المراجعة.");
      setFormOpen(false);
      setForm({ title: "", type: "", city: "", majors: "", description: "", requirements: "", endDate: "" });
      setPortalTab("programs");
      load();
    } catch (requestError) {
      setNotice(requestError.response?.data?.error || "تعذر إرسال طلب الفرصة.");
    } finally { setSaving(false); }
  };

  const copy = async (value) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setNotice("تم نسخ الرابط."); }
    catch { setNotice("تعذر نسخ الرابط. انسخه من شريط المتصفح."); }
  };

  const endDemo = async () => {
    const confirmed = window.confirm("سيتم حذف البيانات والطلبات التجريبية فقط، ولن يؤثر ذلك على أي طلبات أو برامج حقيقية.");
    if (!confirmed) return;
    setEndingDemo(true);
    try {
      await axios.post(`${API_BASE_URL}/api/company-portal/${encodeURIComponent(companySlug)}/demo/end`, {}, { params: { access } });
      setSelectedDemoApplicant(null);
      setNotice("تم إنهاء العرض التجريبي. لم تتأثر أي بيانات حقيقية.");
      await load();
    } catch (requestError) {
      setNotice(requestError.response?.data?.error || "تعذر إنهاء العرض التجريبي.");
    } finally { setEndingDemo(false); }
  };

  const company = data?.company || {};
  const realPrograms = Array.isArray(data?.programs) ? data.programs : [];
  const demoPrograms = data?.demoMode && Array.isArray(data?.demoPrograms) ? data.demoPrograms : [];
  const programs = data?.demoMode ? demoPrograms : realPrograms;
  const latestApplicants = useMemo(
    () => (Array.isArray(data?.latestApplicants) ? data.latestApplicants : []).map(
      (applicant) => applicant.isDemo ? { ...applicant, status: demoStatus } : applicant
    ),
    [data?.latestApplicants, demoStatus]
  );
  const metrics = useMemo(() => {
    if (!data?.demoMode) return data?.metrics || { total: 0, new: 0, reviewing: 0, shortlisted: 0 };
    return latestApplicants.reduce((result, applicant) => {
      result.total += 1;
      if (applicant.status === "new") result.new += 1;
      if (applicant.status === "reviewing") result.reviewing += 1;
      if (applicant.status === "shortlisted") result.shortlisted += 1;
      return result;
    }, { total: 0, new: 0, reviewing: 0, shortlisted: 0 });
  }, [data?.demoMode, data?.metrics, latestApplicants]);
  const primaryProgram = programs.find((program) => program.isOpen) || programs[0];
  const hasReviewActivity = Number(metrics.reviewing || 0) + Number(metrics.shortlisted || 0) > 0;
  const hasSelection = latestApplicants.some((applicant) => ["interview", "accepted"].includes(applicant.status));
  const journey = [
    ["إعداد البرنامج", programs.length > 0],
    ["نشر رابط التقديم", Boolean(primaryProgram?.isOpen || primaryProgram?.isDemo)],
    ["استقبال الطلبات", Number(metrics.total || 0) > 0],
    ["مراجعة المرشحين", hasReviewActivity],
    ["الاختيار", hasSelection],
  ];
  const metricCards = [
    ["إجمالي المتقدمين", metrics.total, "total", "◎"],
    ["جديد", metrics.new, "new", "+"],
    ["قيد المراجعة", metrics.reviewing, "reviewing", "⌕"],
    ["مرشح", metrics.shortlisted, "shortlisted", "✓"],
  ];
  const showPrograms = activeTab === "overview" || activeTab === "programs";
  const showApplicants = activeTab === "overview" || activeTab === "applicants";

  if (loading) return <main className="company-share-page" dir="rtl"><div className="company-share-state">جار تحميل البوابة...</div></main>;
  if (error) return <main className="company-share-page" dir="rtl"><div className="company-share-state company-share-error"><h1>تعذر فتح البوابة</h1><p>{error}</p></div></main>;

  return (
    <main className="company-share-page" dir="rtl" style={{ fontFamily: font }}>
      <section className="company-share-shell company-portal-v2">
        <header className="company-share-header"><img className="company-portal-darbak-logo" src="/logo.png" alt="دربك" /><span>بوابة برامج التدريب</span></header>
        <nav className="company-portal-menu" aria-label="تنقل بوابة الشركة">
          {[['overview', 'نظرة عامة'], ['programs', 'البرامج'], ['applicants', 'المتقدمون'], ['request', 'إضافة فرصة']].map(([tab, label]) => (
            <button key={tab} type="button" className={activeTab === tab || (tab === "overview" && activeTab === "") ? "is-active" : ""} onClick={() => setPortalTab(tab)}>{label}</button>
          ))}
        </nav>
        <section className="company-share-hero company-portal-hero">
          <span className="company-share-logo">{company.logoUrl ? <img src={company.logoUrl} alt={`شعار ${company.name}`} /> : (company.name || "د").charAt(0)}</span>
          <div><p>بوابة برامج التدريب</p><h1>{company.name}</h1><h2>{company.city || "برامج التدريب والتقديم"}</h2></div>
          <div className="company-portal-actions">
            <button type="button" className="company-share-export" onClick={() => setPortalTab("request")}>إضافة فرصة</button>
            {primaryProgram?.applyUrl && !primaryProgram?.isDemo && <button type="button" className="company-share-cv" onClick={() => copy(primaryProgram.applyUrl)}>نسخ رابط التقديم</button>}
            {primaryProgram?.applicationsShareUrl && !primaryProgram?.isDemo ? <a className="company-share-cv" href={primaryProgram.applicationsShareUrl} target="_blank" rel="noreferrer">عرض المتقدمين</a> : <button type="button" className="company-share-cv" onClick={() => setPortalTab("applicants")}>عرض المتقدمين</button>}
          </div>
        </section>

        {data?.demoMode && <div className="company-portal-demo-row"><div className="company-portal-demo-badge">بيانات تجريبية - للعرض فقط</div><button type="button" className="company-portal-demo-end" onClick={endDemo} disabled={endingDemo}>{endingDemo ? "جار الإنهاء..." : "إنهاء العرض التجريبي"}</button></div>}
        {notice && <p className="company-share-privacy">{notice}</p>}

        {(activeTab === "overview" || activeTab === "") && <>
          <section className="company-portal-journey" aria-label="رحلة البرنامج">
            {journey.map(([label, complete], index) => <React.Fragment key={label}>
              <div className={`company-portal-step ${complete ? "is-complete" : ""}`}><span>{complete ? "✓" : index + 1}</span><strong>{label}</strong></div>
              {index < journey.length - 1 && <i className={complete ? "is-complete" : ""} />}
            </React.Fragment>)}
          </section>
          <section className="company-portal-metrics" aria-label="ملخص المتقدمين">
            {metricCards.map(([label, value, status, icon]) => <article key={label} className={`is-${status}`}><i aria-hidden="true">{icon}</i><strong>{Number(value || 0)}</strong><span>{label}</span></article>)}
          </section>
        </>}

        {(formOpen || activeTab === "request") && <form className="company-share-controls company-portal-request" onSubmit={submitRequest}>
          <h2>إضافة فرصة جديدة</h2><p>سيظهر الطلب في حالة بانتظار مراجعة دربك، ولن ينشر مباشرة.</p>
          {[['title','عنوان الفرصة'],['type','نوع البرنامج'],['city','المدينة'],['majors','التخصصات، افصل بفاصلة']].map(([key, placeholder]) => <input key={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} required={key === "title"} />)}
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="وصف الفرصة" />
          <textarea value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} placeholder="المتطلبات" />
          <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          <button className="company-share-export" disabled={saving}>{saving ? "جار الإرسال..." : "إرسال للمراجعة"}</button>
        </form>}

        {(showApplicants || showPrograms) && <div className={`company-portal-content-grid ${activeTab !== "overview" ? "is-focused" : ""}`}>
          {showApplicants && <section className="company-portal-section company-portal-latest-section">
            <div className="company-portal-section-head"><div><p>المتقدمون</p><h2>آخر المتقدمين</h2></div>{primaryProgram?.applicationsShareUrl && !primaryProgram?.isDemo ? <a href={primaryProgram.applicationsShareUrl} target="_blank" rel="noreferrer">عرض الكل</a> : null}</div>
            {latestApplicants.length ? <div className="company-portal-applicants">{latestApplicants.slice(0, 4).map((applicant) => <article key={applicant.id} className={applicant.isDemo ? "is-demo" : ""}>
              <span className="company-portal-avatar">{(applicant.fullName || "م").charAt(0)}</span>
              <div><strong>{applicant.fullName}</strong><small>{applicant.major || "تخصص غير محدد"} {applicant.university ? `· ${applicant.university}` : ""}</small>{applicant.isDemo && <b>طلب تجريبي - ليس متقدمًا حقيقيًا</b>}</div>
              <em className={`company-portal-status is-${applicant.status}`}>{statusLabels[applicant.status] || "جديد"}</em>
              {applicant.isDemo && <button type="button" className="company-portal-view-demo" onClick={() => setSelectedDemoApplicant(applicant)}>عرض الطلب</button>}
            </article>)}</div> : <div className="company-portal-empty">ستظهر آخر الطلبات هنا فور وصولها.</div>}
          </section>}

          {showPrograms && <section className="company-portal-section company-portal-programs-section">
            <div className="company-portal-section-head"><div><p>البرامج</p><h2>برامج الشركة</h2></div><button type="button" className="company-share-linkedin" onClick={() => setPortalTab("request")}>إضافة فرصة</button></div>
            {programs.length ? <div className="company-portal-programs">{programs.map((program) => {
              const overview = `/company/${company.slug}/program/${program.id}?access=${encodeURIComponent(access)}`;
              return <article key={program.id} className={program.isDemo ? "is-demo" : ""}>
                <div><span className={`company-portal-program-status is-${program.status}`}>{programLabels[program.status] || program.status}</span><h3>{program.opportunityTitle}</h3><p>{program.city || "المدينة غير محددة"} · {Number(program.applicationCount || 0)} متقدم</p>{program.isDemo && <b>برنامج تجريبي - لا يظهر للطلاب</b>}</div>
                <div className="company-portal-program-actions">{program.isDemo ? <button type="button" className="company-share-cv" onClick={() => setPortalTab("applicants")}>عرض الطلب التجريبي</button> : <><Link className="company-share-cv" to={overview}>عرض البرنامج</Link>{program.applicationsShareUrl && <a className="company-share-linkedin" href={program.applicationsShareUrl} target="_blank" rel="noreferrer">المتقدمون</a>}<button type="button" className="company-share-linkedin" onClick={() => copy(program.applyUrl)}>نسخ رابط التقديم</button></>}</div>
              </article>;
            })}</div> : <div className="company-portal-empty"><strong>لا يوجد برنامج منشور بعد</strong><p>أضف فرصة جديدة وسيتم مراجعتها من فريق دربك قبل النشر.</p><button type="button" className="company-share-export" onClick={() => setPortalTab("request")}>إضافة فرصة</button></div>}
          </section>}
        </div>}
        <p className="company-share-privacy">هذه البوابة مخصصة لإدارة برامج الجهة وطلبات المتقدمين فقط.</p>
      </section>

      {selectedDemoApplicant && <div className="company-demo-modal-backdrop" role="presentation" onMouseDown={() => setSelectedDemoApplicant(null)}>
        <section className="company-demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-applicant-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="company-demo-modal-head"><div><span>بيانات تجريبية</span><h2 id="demo-applicant-title">طلب {selectedDemoApplicant.fullName}</h2></div><button type="button" aria-label="إغلاق" onClick={() => setSelectedDemoApplicant(null)}>×</button></div>
          <p className="company-demo-modal-note">طلب تجريبي - ليس متقدمًا حقيقيًا. يمكنك تجربة تغيير الحالة بأمان.</p>
          <div className="company-demo-details"><div><small>التخصص</small><strong>{selectedDemoApplicant.major}</strong></div><div><small>الجامعة</small><strong>{selectedDemoApplicant.university}</strong></div><div><small>المدينة</small><strong>{selectedDemoApplicant.city}</strong></div><div><small>تاريخ التقديم</small><strong>{new Date(selectedDemoApplicant.submittedAt).toLocaleDateString("ar-SA")}</strong></div></div>
          <section className="company-demo-block"><h3>إجابات الطلب</h3>{(selectedDemoApplicant.answers || []).map((answer) => <p key={answer.label}><strong>{answer.label}</strong>{answer.value}</p>)}</section>
          <section className="company-demo-block"><h3>ملاحظة داخلية</h3><p>{selectedDemoApplicant.internalNote}</p></section>
          <section className="company-demo-block"><h3>حالة الطلب</h3><div className="company-demo-statuses">{demoStatuses.map((status) => <button type="button" key={status} className={demoStatus === status ? "is-active" : ""} onClick={() => setDemoStatus(status)}>{statusLabels[status]}</button>)}</div></section>
        </section>
      </div>}
    </main>
  );
};

export default CompanyPortalPage;

import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useParams, useSearchParams } from "react-router-dom";
import API_BASE_URL from "../config/api";

const font = "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif";

const CompanyPortalPage = () => {
  const { companySlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const access = searchParams.get("access") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "", city: "", majors: "", description: "", requirements: "", endDate: "" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

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
        endDate: form.endDate,
      }, { params: { access } });
      setNotice("تم إرسال الفرصة للمراجعة. سننشرها بعد الاعتماد.");
      setFormOpen(false);
      setForm({ title: "", type: "", city: "", majors: "", description: "", requirements: "", endDate: "" });
      load();
    } catch (requestError) {
      setNotice(requestError.response?.data?.error || "تعذر إرسال طلب الفرصة.");
    } finally { setSaving(false); }
  };

  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); setNotice("تم نسخ الرابط."); }
    catch { setNotice("تعذر نسخ الرابط. انسخه من شريط المتصفح."); }
  };

  if (loading) return <main className="company-share-page" dir="rtl"><div className="company-share-state">جار تحميل البوابة...</div></main>;
  if (error) return <main className="company-share-page" dir="rtl"><div className="company-share-state company-share-error"><h1>تعذر فتح البوابة</h1><p>{error}</p></div></main>;
  const company = data?.company || {};
  const programs = Array.isArray(data?.programs) ? data.programs : [];

  return (
    <main className="company-share-page" dir="rtl" style={{ fontFamily: font }}>
      <section className="company-share-shell">
        <header className="company-share-header"><div className="company-share-brand">دربك</div><span>بوابة الجهة</span></header>
        <section className="company-share-hero">
          <span className="company-share-logo">{company.logoUrl ? <img src={company.logoUrl} alt={`شعار ${company.name}`} /> : (company.name || "د").charAt(0)}</span>
          <div><p>برامج التقديم</p><h1>{company.name}</h1><h2>{company.city || ""}</h2></div>
          <button type="button" className="company-share-export" onClick={() => setFormOpen((value) => !value)}>إضافة فرصة</button>
        </section>
        {notice && <p className="company-share-privacy">{notice}</p>}
        {formOpen && <form className="company-share-controls" onSubmit={submitRequest}>
          {[['title','عنوان الفرصة'],['type','نوع البرنامج'],['city','المدينة'],['majors','التخصصات، افصل بفاصلة']].map(([key, placeholder]) => <input key={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} required={key === 'title'} />)}
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="وصف الفرصة" />
          <textarea value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} placeholder="المتطلبات" />
          <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          <button className="company-share-export" disabled={saving}>{saving ? "جار الإرسال..." : "إرسال للمراجعة"}</button>
        </form>}
        <section className="company-share-table-wrap">
          <h2 style={{ margin: "0 0 14px", color: "var(--app-text, #fff)" }}>البرامج</h2>
          <table className="company-share-table"><thead><tr><th>البرنامج</th><th>الحالة</th><th>المتقدمون</th><th>إجراءات</th></tr></thead><tbody>
            {programs.map((program) => {
              const overview = `/company/${company.slug}/program/${program.id}?access=${encodeURIComponent(access)}`;
              return <tr key={program.id}><td><strong>{program.opportunityTitle}</strong><small>{program.city || ""}</small></td><td>{program.status}</td><td>{program.applicationCount}</td><td><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Link className="company-share-cv" to={overview}>عرض</Link><button type="button" className="company-share-linkedin" onClick={() => copy(program.applyUrl)}>نسخ رابط التقديم</button></div></td></tr>;
            })}
          </tbody></table>
          {!programs.length && <p className="company-share-empty">لا توجد برامج مضافة بعد.</p>}
        </section>
        <p className="company-share-privacy">هذه البوابة مخصصة لإدارة برامج الجهة وطلبات المتقدمين فقط.</p>
      </section>
    </main>
  );
};

export default CompanyPortalPage;

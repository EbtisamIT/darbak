import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus, FiX } from "react-icons/fi";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";
import { PREMIUM_ACCESS_EVENT, PREMIUM_STATUS_EVENT, getAccessHeaders, getStoredAccessIdentity } from "../utils/premiumAccess";
import { isCompanyApplication, applicationStatus, statusLabel,
  formatApplicationDate, nextStep, opportunityPath, monthlySummary, applicationGroup,
  actionForApplication, needsFollowUpReminder, followUpMessage, appliedThisMonth } from "../utils/applicationTracker";
import "./MyApplicationsPage.css";

function ApplicationDialog({ title, onClose, children }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [...panel.current.querySelectorAll('button:not(:disabled), input, select, textarea, a[href]')];
    focusable()[0]?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [onClose, title]);
  return <div className="application-dialog-backdrop" onClick={onClose}>
    <section ref={panel} className="application-dialog" role="dialog" aria-modal="true" aria-labelledby="application-dialog-title" onClick={(event) => event.stopPropagation()}>
      <header><h2 id="application-dialog-title">{title}</h2><button type="button" onClick={onClose} aria-label="إغلاق"><FiX /></button></header>
      {children}
    </section>
  </div>;
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const summaryGroups = [["waiting", "بانتظار الرد"], ["action", "تحتاج خطوة"], ["interview", "مقابلة"], ["accepted", "قبول"]];
const updateChoices = [
  ["waiting", "بانتظار الرد"],
  ["action_required", "طُلبت معلومات"],
  ["interview", "مقابلة"],
  ["accepted", "تم القبول"],
  ["withdrawn", "لم يكتمل التقديم"],
];
const personalStatusLabels = {
  applied: "بانتظار الرد", saved: "بانتظار الرد", waiting: "بانتظار الرد",
  under_review: "تحت المراجعة", action_required: "تحتاج خطوة",
  contacted: "تحتاج خطوة", interview: "مقابلة",
  accepted: "قبول", offer: "قبول",
  withdrawn: "لم يكتمل", rejected: "مرفوض",
};
const statusGroup = (item) => {
  const status = applicationStatus(item);
  if (["action_required", "contacted"].includes(status)) return "information";
  if (status === "interview") return "interview";
  if (["accepted", "offer"].includes(status)) return "accepted";
  if (["withdrawn", "rejected"].includes(status)) return "inactive";
  return "waiting";
};
const personalStatusLabel = (item) => isCompanyApplication(item)
  ? ({ submitted: "بانتظار الرد", under_review: "تحت المراجعة", shortlisted: "وصل رد من الجهة",
    interview: "مقابلة", accepted: "قبول", rejected: "مرفوض",
    withdrawn: "لم يكتمل" })[applicationStatus(item)] || statusLabel(item)
  : personalStatusLabels[applicationStatus(item)] || statusLabel(item);
const appliedAgo = (value) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const days = Math.max(0, Math.floor((Date.now() - time) / 86400000));
  return `تم التقديم ${new Intl.RelativeTimeFormat("ar-SA", { numeric: "auto" }).format(-days, "day")}`;
};
const timelineText = (item) => {
  const applied = new Date(item.appliedAt || item.submittedAt).getTime();
  const updated = new Date(item.lastUpdatedAt || item.updatedAt).getTime();
  return Number.isFinite(updated) && Number.isFinite(applied) && updated > applied
    ? `آخر تحديث ${new Intl.RelativeTimeFormat("ar-SA", { numeric: "auto" }).format(-Math.max(0, Math.floor((Date.now() - updated) / 86400000)), "day")}`
    : appliedAgo(item.appliedAt || item.submittedAt);
};
const followUpAge = (item, now) => Math.floor((now - new Date(item.appliedAt).getTime()) / 86400000);

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAllActions, setShowAllActions] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [mailLanguage, setMailLanguage] = useState("ar");
  const [mailDraft, setMailDraft] = useState({ subject: "", body: "" });
  const knownStudent = applications.find((item) => isCompanyApplication(item) && item.fullName);
  const mailSender = { name: knownStudent?.fullName, contact: knownStudent?.phone || knownStudent?.portfolioUrl };
  const closeDialog = useCallback(() => setDialog(null), []);
  const fetchApplications = useCallback(async () => {
    const identity = getStoredAccessIdentity();
    if (!identity.contact || !identity.accessCode) { setApplications([]); setRequiresLogin(true); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/application-tracker/me`, { headers: getAccessHeaders() });
      setApplications(Array.isArray(data.data) ? data.data : []); setRequiresLogin(false);
    } catch (err) {
      setApplications([]);
      if (err.response?.status === 401) setRequiresLogin(true);
      else setError(err.response?.data?.error || "تعذر تحميل تقديماتك الآن.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    document.title = "تقديماتي | دربك";
    trackEvent("student_applications_page_viewed", { page: "/applications" });
    fetchApplications();
    window.addEventListener(PREMIUM_STATUS_EVENT, fetchApplications);
    window.addEventListener("storage", fetchApplications);
    return () => { window.removeEventListener(PREMIUM_STATUS_EVENT, fetchApplications); window.removeEventListener("storage", fetchApplications); };
  }, [fetchApplications]);
  const openDialog = (mode, item) => {
    setSaveError(""); setDialog({ mode, item });
    if (mode === "follow_up") { setMailLanguage("ar"); setMailDraft(followUpMessage(item, "ar", mailSender)); }
    setDraft(item ? { studentStatus: "", note: item.note || "" } :
      { companyName: "", roleTitle: "", city: "", contactEmail: "", appliedAt: today(), studentStatus: "applied" });
  };
  const field = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  const save = async (event) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setSaveError("");
    try {
      const { mode, item } = dialog;
      const headers = { headers: getAccessHeaders() };
      const id = item?.id || item?._id;
      const payload = mode === "manual"
        ? { ...draft, appliedAt: `${draft.appliedAt}T12:00:00+03:00` }
        : { studentStatus: draft.studentStatus, note: draft.note, recordType: "tracker" };
      const { data } = mode === "manual" ? await axios.post(`${API_BASE_URL}/api/application-tracker`, payload, headers) :
        await axios.patch(`${API_BASE_URL}/api/application-tracker/me/${encodeURIComponent(id)}/status`, payload, headers);
      setApplications((items) => mode === "manual" ? [data.data, ...items] : items.map((old) => (old.id || old._id) === id && !isCompanyApplication(old) ? data.data : old));
      setNotice(mode === "manual" ? "تمت إضافة التقديم." : "تم حفظ التحديث."); setDialog(null);
    } catch (err) { setSaveError(err.response?.data?.error || "تعذر الحفظ الآن. حاول مرة أخرى."); }
    finally { setSaving(false); }
  };
  const now = Date.now();
  const summary = monthlySummary(applications, now);
  const visible = filter === "all" ? applications : applications.filter((item) => appliedThisMonth(item, now) && applicationGroup(item, now) === filter);
  const actionPriority = { information: 0, interview: 1, follow_up: 2 };
  const actions = applications.map((item) => ({ item, action: actionForApplication(item, now) }))
    .filter(({ action }) => action)
    .sort((a, b) => (actionPriority[a.action] ?? 3) - (actionPriority[b.action] ?? 3) ||
      new Date(a.item.followUpAt || a.item.appliedAt).getTime() - new Date(b.item.followUpAt || b.item.appliedAt).getTime());
  const currentDetails = dialog?.item && applications.find((item) => (item.id || item._id) === (dialog.item.id || dialog.item._id) && item.recordType === dialog.item.recordType);
  const saveFollowUpAction = async (item, action) => {
    setSaveError("");
    try {
      const id = item.id || item._id;
      const { data } = await axios.patch(`${API_BASE_URL}/api/application-tracker/me/${encodeURIComponent(id)}/follow-up`,
        { action }, { headers: getAccessHeaders() });
      setApplications((items) => items.map((old) => (old.id || old._id) === id && !isCompanyApplication(old) ? data.data : old));
      if (action === "sent") setNotice("تم تسجيل إرسال المتابعة.");
      setDialog(null);
    } catch (err) { setSaveError(err.response?.data?.error || "تعذر حفظ المتابعة الآن."); }
  };
  const switchMailLanguage = (language) => { setMailLanguage(language); setMailDraft(followUpMessage(dialog.item, language, mailSender)); };
  const mailto = () => {
    if (!dialog?.item?.contactEmail) return;
    window.location.href = `mailto:${encodeURIComponent(dialog.item.contactEmail)}?subject=${encodeURIComponent(mailDraft.subject)}&body=${encodeURIComponent(mailDraft.body)}`;
  };

  return <main dir="rtl" className="my-applications-page">
    <header className="my-applications-hero">
      <h1>تقديماتي</h1>
      <p>تابع طلباتك، آخر تحديث لكل فرصة، والخطوة المطلوبة منك.</p>
      {!loading && !requiresLogin && !error && <button className="application-add-link" type="button" onClick={() => openDialog("manual")}><FiPlus /> أضف فرصة خارج دربك</button>}
    </header>
    {loading ? <section className="my-applications-empty">جار تحميل التقديمات...</section> : requiresLogin ?
      <section className="my-applications-empty"><h2>تسجيل الدخول لعرض تقديماتك</h2><button onClick={() => window.dispatchEvent(new CustomEvent(PREMIUM_ACCESS_EVENT, { detail: { loginOnly: true, feature: "student_applications", title: "تسجيل الدخول لعرض تقديماتي" } }))}>تسجيل الدخول</button></section> : error ?
      <section className="my-applications-empty"><p role="alert">{error}</p><button onClick={fetchApplications}>إعادة المحاولة</button></section> : <>
        {actions.length > 0 && <section className="application-required" aria-label="يتطلب إجراء"><h2>يتطلب إجراء</h2>
          {actions.slice(0, showAllActions ? actions.length : 1).map(({ item, action }) => <div className="application-required-row" key={`${item.recordType}:${item.id || item._id}`}>
            <div><strong>{action === "follow_up" ? `لم يصلك تحديث من ${item.organizationName} منذ ${followUpAge(item, now)} أيام` :
              action === "interview" ? `مقابلة قادمة لدى ${item.organizationName}` :
                `${item.organizationName} طلبت إجراءً إضافيًا`}</strong>
              <small>{action === "follow_up" ? "يمكنك تحديث الحالة أو إرسال متابعة للجهة." :
                action === "interview" ? `الموعد: ${formatApplicationDate(item.followUpAt)}` :
                  item.studentVisibleMessage || item.note || timelineText(item)}</small></div>
            <div className="application-required-actions">
              {action === "follow_up" && <button type="button" onClick={() => openDialog("status", item)}>تحديث الحالة</button>}
              <button type="button" onClick={() => openDialog(action === "follow_up" ? "follow_up" : "details", item)}>
                {action === "follow_up" ? "إرسال متابعة" : "عرض التفاصيل"}</button>
            </div>
          </div>)}
          {actions.length > 1 && <button type="button" className="application-more-actions" aria-expanded={showAllActions} onClick={() => setShowAllActions(!showAllActions)}>
            {showAllActions ? "إخفاء الإجراءات الأخرى" : `+ ${actions.length - 1} إجراءات أخرى`}</button>}
        </section>}
        {applications.length > 0 && <section className="application-monthly-summary" aria-label="ملخص التقديمات هذا الشهر">
          <h2>ملخص التقديمات هذا الشهر</h2>
          <div className="application-summary-options" role="group" aria-label="تصفية التقديمات">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}><span>الكل</span><strong>{applications.length}</strong></button>
            {summaryGroups.map(([group, label]) => <button type="button" key={group} aria-pressed={filter === group} onClick={() => setFilter(group)}>
              <span>{label}</span><strong>{summary[group]}</strong>
            </button>)}
          </div>
        </section>}
        {applications.length > 0 && <h2 className="application-list-title">{filter === "all" ? "تقديماتك" : summaryGroups.find(([group]) => group === filter)?.[1]}</h2>}
        {!applications.length ? <section className="my-applications-empty"><h2>لا توجد تقديمات بعد</h2><p>ستظهر هنا الفرص التي تقدمت إليها عبر دربك أو أضفتها بنفسك.</p><Link to="/where-to-train">استكشاف الفرص</Link></section> : !visible.length ?
          <section className="my-applications-empty"><p>لا توجد تقديمات بهذه الحالة.</p><button onClick={() => setFilter("all")}>عرض الكل</button></section> :
          <section className="my-applications-list" aria-label="قائمة التقديمات">{visible.map((item) => <article className="application-card" key={`${item.recordType}:${item.id || item._id}`}>
            <div className="application-card-head">
              <div className="application-company-mark">{item.organizationLogoUrl ? <img src={item.organizationLogoUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false; }} /> : null}<span hidden={Boolean(item.organizationLogoUrl)}>{(item.organizationName || "جهة").charAt(0)}</span></div>
              <div className="application-company-title">
                <h2>{item.organizationName || "جهة تدريبية"}</h2>
                <p>{item.opportunityTitle || "فرصة تدريب"}</p>
                <small>{[item.programType, item.city].filter(Boolean).join(" · ")}</small>
              </div>
              <span className={`application-status status-${statusGroup(item)}`}>{personalStatusLabel(item)}</span>
            </div>
            <div className="application-card-footer">
              <span className="application-applied-ago">{timelineText(item)}</span>
              <div className="application-card-actions">
                {!isCompanyApplication(item) && <button type="button" className="application-primary" onClick={() => openDialog("status", item)}>تحديث التقديم</button>}
                <button type="button" className="application-details-link" onClick={() => openDialog("details", item)}>التفاصيل</button>
              </div>
            </div>
          </article>)}</section>}
        <button type="button" className="application-guide-link" onClick={() => window.dispatchEvent(new Event("darbak:open-smart-assistant"))}>دليل دربك</button>
      </>}
    {notice && <p className="application-report-notice" role="status">{notice}</p>}
    {dialog && <ApplicationDialog title={dialog.mode === "manual" ? "إضافة تقديم خارجي" : dialog.mode === "details" ? "تفاصيل التقديم" : dialog.mode === "follow_up" ? "رسالة متابعة" : "ما آخر تحديث للتقديم؟"} onClose={closeDialog}>
      {dialog.mode === "details" && currentDetails ? <div className="application-details">
        <h3>{currentDetails.organizationName}</h3>
        <p>{currentDetails.opportunityTitle || "فرصة تدريب"}{currentDetails.city ? ` · ${currentDetails.city}` : ""}</p>
        {isCompanyApplication(currentDetails) && <small className="application-source-note">تم التقديم عبر دربك</small>}
        <p>{statusLabel(currentDetails)}</p>
        <p>تم التقديم في {formatApplicationDate(currentDetails.appliedAt || currentDetails.submittedAt)}</p>
        <h3>الخطوة القادمة</h3><p>{nextStep(currentDetails)}</p>
        <h3>تحديثات التقديم</h3><ol className="application-timeline"><li><strong>{applicationStatus(currentDetails) === "saved" ? "تم الحفظ" : "تم التقديم"}</strong><time>{formatApplicationDate(currentDetails.appliedAt || currentDetails.submittedAt)}</time></li>
          {(currentDetails.statusHistory || []).filter((entry, index) => index !== 0 || entry.status !== "applied" || new Date(entry.changedAt).getTime() !== new Date(currentDetails.appliedAt).getTime()).map((entry, index) => <li key={index}><strong>{isCompanyApplication(currentDetails) ? entry.statusLabel || entry.status : entry.status ? personalStatusLabel({ studentStatus: entry.status }) : "تم تحديث الملاحظة"}</strong><time>{formatApplicationDate(entry.changedAt)}</time>{entry.followUpAt && <p>الموعد: {formatApplicationDate(entry.followUpAt)}</p>}{entry.note && <p>{entry.note}</p>}{entry.studentVisibleMessage && <p>{entry.studentVisibleMessage}</p>}</li>)}
        </ol>
        {currentDetails.note && <><h3>ملاحظاتك</h3><p>{currentDetails.note}</p></>}
        {needsFollowUpReminder(currentDetails, now) && <div className="application-follow-up"><strong>لم يصلك تحديث منذ {followUpAge(currentDetails, now)} أيام</strong><p>يمكن إرسال رسالة متابعة قصيرة للجهة.</p>
          <div><button type="button" onClick={() => openDialog("follow_up", currentDetails)}>إرسال متابعة</button>
            <button type="button" onClick={() => saveFollowUpAction(currentDetails, "snooze")}>تذكيري بعد 3 أيام</button>
            <button type="button" onClick={() => saveFollowUpAction(currentDetails, "dismiss")}>لا أحتاج متابعة</button></div></div>}
        {opportunityPath(currentDetails) && <Link to={opportunityPath(currentDetails)} className="application-opportunity-link">فتح الفرصة</Link>}
        {!isCompanyApplication(currentDetails) && <button className="application-primary" type="button" onClick={() => openDialog("status", currentDetails)}>تحديث التقديم</button>}
      </div> : dialog.mode === "follow_up" ? <div className="application-form">
        <label>اللغة<select value={mailLanguage} onChange={(event) => switchMailLanguage(event.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></label>
        <label>عنوان الرسالة<input value={mailDraft.subject} onChange={(event) => setMailDraft((draft) => ({ ...draft, subject: event.target.value }))} /></label>
        <label>نص الرسالة<textarea rows={12} dir={mailLanguage === "en" ? "ltr" : "rtl"} value={mailDraft.body} onChange={(event) => setMailDraft((draft) => ({ ...draft, body: event.target.value }))} /></label>
        {saveError && <p role="alert">{saveError}</p>}
        <div className="application-form-actions"><button type="button" onClick={() => navigator.clipboard.writeText(`${mailDraft.subject}\n\n${mailDraft.body}`).then(() => setNotice("تم نسخ الرسالة.")).catch(() => setSaveError("تعذر نسخ الرسالة."))}>نسخ الرسالة</button>
          {dialog.item.contactEmail && <button type="button" onClick={mailto}>فتح البريد</button>}
          <button type="button" className="application-primary" onClick={() => saveFollowUpAction(dialog.item, "sent")}>تم الإرسال</button></div>
      </div> : <form onSubmit={save} className="application-form">
        {dialog.mode === "manual" ? <>
          <label>اسم الجهة<input required maxLength={180} value={draft.companyName} onChange={(event) => field("companyName", event.target.value)} /></label>
          <label>اسم الفرصة أو مجال التدريب<input maxLength={180} value={draft.roleTitle} onChange={(event) => field("roleTitle", event.target.value)} /></label>
          <label>المدينة<input maxLength={120} value={draft.city} onChange={(event) => field("city", event.target.value)} /></label>
          <label>بريد التواصل لدى الجهة (اختياري)<input type="email" maxLength={254} value={draft.contactEmail} onChange={(event) => field("contactEmail", event.target.value)} /></label>
          <label>تاريخ التقديم<input required type="date" value={draft.appliedAt} onChange={(event) => field("appliedAt", event.target.value)} /></label>
        </> : <>
          <fieldset className="application-status-choices"><legend>اختر آخر تحديث</legend>
            {updateChoices.map(([value, label]) => <label key={value} className={draft.studentStatus === value ? "is-selected" : ""}>
              <input type="radio" name="studentStatus" value={value} checked={draft.studentStatus === value} onChange={() => field("studentStatus", value)} />{label}
            </label>)}
          </fieldset>
          {draft.studentStatus && <label>ملاحظة خاصة (اختيارية)<textarea maxLength={500} rows={3} value={draft.note} onChange={(event) => field("note", event.target.value)} /></label>}
        </>}
        {saveError && <p role="alert">{saveError}</p>}
        <div className="application-form-actions"><button type="submit" className="application-primary" disabled={saving || (dialog.mode === "status" && !draft.studentStatus)}>{saving ? "جار الحفظ..." : dialog.mode === "manual" ? "حفظ التقديم" : "حفظ التحديث"}</button><button type="button" onClick={closeDialog}>إلغاء</button></div>
      </form>}
    </ApplicationDialog>}
  </main>;
}

import React, { useMemo, useState } from "react";
import { FiCheckCircle, FiChevronDown, FiCopy, FiExternalLink, FiFileText, FiMail } from "react-icons/fi";

const labels = {
  ready: "جاهز ✓",
  needs_input: "تحتاج معلومة",
  unavailable: "غير متاح",
};

const PackPart = ({ icon, title, secondaryLabel = "", description = "", status, open, onOpen, children }) => (
  <article className={`application-pack-part is-${status || "ready"}`}>
    <div className="application-pack-part-head">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        {secondaryLabel && <em>{secondaryLabel}</em>}
      </div>
      <small>{labels[status] || labels.ready}</small>
    </div>
    {description && <p className="application-pack-description">{description}</p>}
    <button type="button" className="application-pack-open" onClick={onOpen}>
      {open ? "إخفاء" : "فتح"} <FiChevronDown aria-hidden="true" />
    </button>
    {open && <div className="application-pack-part-content">{children}</div>}
  </article>
);

const ApplicationPackPanel = ({ pack, onCompleteDetails, onOpenResume }) => {
  const [trainingStart, setTrainingStart] = useState("");
  const [trainingEnd, setTrainingEnd] = useState("");
  const [targetField, setTargetField] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openPart, setOpenPart] = useState("");
  const readyCount = useMemo(
    () => [pack?.resume, pack?.trainingLetter, pack?.email].filter((part) => part?.status === "ready").length,
    [pack]
  );
  if (!pack || !Object.keys(pack).length) return null;
  const info = pack.applicationInfo || {};
  const missingFields = pack.missingApplicationFields || [];
  const needsPeriod = missingFields.some((item) => item.key === "trainingPeriod");
  const needsTargetField = missingFields.some((item) => item.key === "targetField");
  const completePeriod = async (event) => {
    event.preventDefault();
    if ((needsPeriod && (!trainingStart.trim() || !trainingEnd.trim())) || (needsTargetField && !targetField.trim())) {
      setError(needsTargetField ? "أكمل فترة التدريب والمجال المستهدف." : "أضف بداية ونهاية فترة التدريب.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await onCompleteDetails({ trainingStart, trainingEnd, targetField });
    } catch (requestError) {
      setError(requestError?.message || "تعذر إكمال رسالة التقديم.");
    } finally {
      setSaving(false);
    }
  };
  const copyEmail = async () => {
    await navigator.clipboard?.writeText([pack.email?.subject, pack.email?.body].filter(Boolean).join("\n\n"));
  };
  const studentSummary = (pack.customizationSummary || []).map((item) => {
    if (/مشروع.*دربك|دربك.*مشروع/u.test(item)) return "أبرزنا مشروع دربك.";
    if (/React|UI|UX|واجهات/u.test(item)) return "قدمنا مهارات React وواجهة وتجربة المستخدم.";
    if (/نبذ|summary/u.test(item)) return "خصصنا النبذة لتناسب الجهة.";
    if (/شهاد|تطوع/u.test(item)) return "أبرزنا الخبرات والشهادات المرتبطة.";
    return "رتبنا المحتوى الأكثر ارتباطًا بهذه الجهة.";
  }).filter((item, index, items) => items.indexOf(item) === index).slice(0, 4);

  return (
    <section className="application-pack-panel">
      <header>
        <span>{pack.packType === "company_outreach_pack" ? "تواصل مع جهة" : "ملف التقديم"}</span>
        <h2>تقديمك لـ {info.organizationName || "هذه الجهة"}</h2>
        <p>{readyCount} من 3 جاهزة</p>
      </header>
      <div className="application-pack-parts">
        <PackPart icon={<FiFileText aria-hidden="true" />} title="السيرة الذاتية" status={pack.resume?.status} open={openPart === "resume"} onOpen={() => setOpenPart(openPart === "resume" ? "" : "resume")}>
          <button type="button" onClick={onOpenResume}>فتح السيرة</button>
        </PackPart>
        <PackPart icon={<FiCheckCircle aria-hidden="true" />} title="خطاب التقديم" secondaryLabel="Cover Letter" description="رسالة مهنية مخصصة للجهة، وليست خطاب التدريب الرسمي الصادر من الجامعة." status={pack.trainingLetter?.status} open={openPart === "letter"} onOpen={() => setOpenPart(openPart === "letter" ? "" : "letter")}>
          {pack.trainingLetter?.body ? <p className="application-pack-copy">{pack.trainingLetter.body}</p> : <p>لا يحتاج هذا التقديم خطاب تقديم منفصلًا.</p>}
        </PackPart>
        <PackPart icon={<FiMail aria-hidden="true" />} title="رسالة الإيميل" status={pack.email?.status} open={openPart === "email" || pack.email?.status === "needs_input"} onOpen={() => setOpenPart(openPart === "email" ? "" : "email")}>
          {pack.email?.status === "ready" ? <>
            <p className="application-pack-copy"><b>الموضوع:</b> {pack.email.subject}</p>
            <p className="application-pack-copy">{pack.email.body}</p>
            <button type="button" onClick={copyEmail}><FiCopy aria-hidden="true" /> نسخ الإيميل</button>
          </> : pack.email?.status === "unavailable" ? <p>لا توجد وسيلة تقديم موثوقة مرتبطة بهذه الجهة.</p> : null}
          {(needsPeriod || needsTargetField) && <form className="application-pack-details" onSubmit={completePeriod}>
            <strong>باقي {missingFields.length === 1 ? "معلومة واحدة" : "معلومتان"} لإكمال رسالة التقديم</strong>
            {needsPeriod && <>
              <span>فترة التدريب</span>
              <div>
                <input value={trainingStart} onChange={(event) => setTrainingStart(event.target.value)} placeholder="من" />
                <input value={trainingEnd} onChange={(event) => setTrainingEnd(event.target.value)} placeholder="إلى" />
              </div>
            </>}
            {needsTargetField && <label>
              <span>المسمى أو المجال التدريبي المستهدف</span>
              <input value={targetField} onChange={(event) => setTargetField(event.target.value)} placeholder="مثل: تقنية المعلومات أو تطوير الويب" />
            </label>}
            {error && <small className="application-pack-error">{error}</small>}
            <button type="submit" disabled={saving}>{saving ? "جارٍ الإكمال..." : "إكمال رسالة التقديم"}</button>
          </form>}
        </PackPart>
      </div>
      {studentSummary.length > 0 && <div className="application-pack-summary">
        <strong>ماذا خصصنا؟</strong>
        <ul>{studentSummary.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      </div>}
      <div className="application-pack-method">
        <strong>طريقة التقديم</strong>
        {info.applicationMethod === "email" && <a href={`mailto:${info.email}`}><FiMail aria-hidden="true" /> {info.email}</a>}
        {info.applicationMethod === "link" && <a href={info.url} target="_blank" rel="noreferrer"><FiExternalLink aria-hidden="true" /> فتح رابط التقديم</a>}
        {info.applicationMethod === "unavailable" && <span>لا توجد وسيلة تقديم موثوقة في بيانات الجهة.</span>}
      </div>
    </section>
  );
};

export default ApplicationPackPanel;

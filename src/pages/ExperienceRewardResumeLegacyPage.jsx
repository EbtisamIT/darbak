import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import API_BASE_URL from "../config/api";
import ResumePdfDocument from "../features/resume/ResumePdfDocument";
import { toAtsClassicResume } from "../utils/experienceRewardResumeLegacy";
import { cleanRewardDraft, getRewardReadiness, splitRewardBullets } from "../utils/experienceRewardResumeLegacyQuality";
import { getStoredAccessIdentity } from "../utils/premiumAccess";
import "./ExperienceRewardResumePage.css";

const sections = [["trainingExperience", "تجربة التدريب"], ["experience", "الخبرات"],
  ["projects", "المشاريع"], ["certifications", "الشهادات"]];
const emptyEntry = () => ({ title: "", organization: "", location: "", period: "", description: "" });

const entryFields = {
  trainingExperience: [["title", "المسمى أو القسم"], ["organization", "جهة التدريب"], ["location", "المدينة"], ["period", "الفترة"]],
  experience: [["title", "المسمى أو القسم"], ["organization", "الجهة"], ["location", "المدينة"], ["period", "الفترة"]],
  projects: [["title", "اسم المشروع"], ["organization", "الأدوات المستخدمة (افصل بينها بفاصلة)"]],
  certifications: [["title", "اسم الشهادة"], ["organization", "الجهة المانحة"], ["period", "التاريخ"]],
};

function RewardBulletRows({ section, entry, onChange }) {
  const maximum = section === "projects" ? 3 : 4;
  const bullets = splitRewardBullets(entry.description);
  const rows = bullets.length ? bullets : [""];
  const label = section === "projects" ? "مساهماتك في المشروع (1–3 نقاط)" : "ما أنجزته (2–4 نقاط)";
  const helper = section === "projects"
    ? "ركز على دورك أنت في المشروع، وليس وصف فكرة المشروع فقط."
    : "اكتب ماذا عملت فعليًا، والأداة التي استخدمتها أو الشيء الذي ساهمت فيه.";
  const update = (next) => onChange(next.join("\n"));
  return <div className="experience-reward-bullets">
    <p className="experience-reward-field-label">{label}</p>
    <p className="experience-reward-hint">{helper}</p>
    {rows.map((bullet, index) => <div className="experience-reward-bullet-row" key={index}>
      <label><span className="sr-only">نقطة {index + 1}</span>
        <input value={bullet} placeholder={`نقطة ${index + 1}`} onChange={(event) => {
          const next = [...rows]; next[index] = event.target.value; update(next);
        }} />
      </label>
      {rows.length > 1 && <button type="button" className="secondary" aria-label={`حذف نقطة ${index + 1}`}
        onClick={() => update(rows.filter((_, offset) => offset !== index))}>حذف</button>}
    </div>)}
    {rows.length < maximum && <button type="button" className="secondary" onClick={() => update([...rows, ""])}>+ أضف نقطة</button>}
  </div>;
}

export default function ExperienceRewardResumeLegacyPage() {
  const [reward, setReward] = useState(null);
  const [draft, setDraft] = useState(null);
  const [language, setLanguage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [englishReviewed, setEnglishReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const identity = getStoredAccessIdentity();
  const headers = useMemo(() => ({
    "x-darbak-contact": identity.contact || identity.email || "",
    "x-darbak-access-code": identity.accessCode || "",
  }), [identity.contact, identity.email, identity.accessCode]);

  useEffect(() => {
    let live = true;
    axios.get(`${API_BASE_URL}/api/rewards/resume/me`, { headers })
      .then(({ data }) => {
        if (!live) return;
        setReward(data.reward);
        setLanguage(data.reward.language || "");
        setDraft(data.draft || data.prefill);
      })
      .catch((error) => live && setMessage(error.response?.data?.error || "تعذر تحميل المكافأة حاليًا."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [headers]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const setField = (name, value) => { setDraft((current) => ({ ...current, [name]: value })); setPreviewUrl(""); };
  const setEntry = (section, index, field, value) => {
    setDraft((current) => ({ ...current, [section]: current[section].map((entry, offset) =>
      offset === index ? { ...entry, [field]: value } : entry) }));
    setPreviewUrl("");
  };
  const readiness = getRewardReadiness(draft || {}, language);
  const saveDraft = async () => {
    const cleaned = cleanRewardDraft(draft);
    const { data } = await axios.put(`${API_BASE_URL}/api/rewards/resume/draft`,
      { language, draft: cleaned }, { headers });
    setDraft(data.draft);
    setReward((current) => ({ ...current, language: data.language }));
    return data.draft;
  };
  const makePdf = async (savedDraft) => pdf(
    <ResumePdfDocument resume={toAtsClassicResume(savedDraft, language)} rewardPresentation />
  ).toBlob();
  const preview = async () => {
    try {
      setBusy(true); setMessage("");
      const saved = await saveDraft();
      const blob = await makePdf(saved);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      setMessage(error.response?.data?.error || "تعذرت معاينة السيرة حاليًا.");
    } finally { setBusy(false); }
  };
  const finalize = async () => {
    if (language === "en" && !englishReviewed) {
      setMessage("راجع نص السيرة بالإنجليزية قبل الاعتماد.");
      return;
    }
    if (readiness.missing.length) {
      setMessage(`أكمل قبل الاعتماد: ${readiness.missing.join("، ")}.`);
      return;
    }
    try {
      setBusy(true); setMessage("");
      const saved = await saveDraft();
      const blob = await makePdf(saved);
      await axios.post(`${API_BASE_URL}/api/rewards/resume/finalize`, blob,
        { headers: { ...headers, "Content-Type": "application/pdf" } });
      setReward((current) => ({ ...current, status: "redeemed" }));
      setPreviewUrl("");
      setMessage("تم اعتماد سيرتك. يمكنك تنزيل النسخة النهائية وقتما تشاء.");
    } catch (error) {
      setMessage(error.response?.data?.error || "تعذر اعتماد السيرة حاليًا.");
    } finally { setBusy(false); }
  };
  const download = async () => {
    try {
      setBusy(true); setMessage("");
      const { data } = await axios.get(`${API_BASE_URL}/api/rewards/resume/pdf`,
        { headers, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "darbak-ats-classic.pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMessage("تعذر تنزيل السيرة حاليًا."); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="experience-reward-page" dir="rtl">جاري تحميل المكافأة...</main>;
  if (!reward) return <main className="experience-reward-page" dir="rtl"><h1>مكافأة السيرة الذاتية</h1><p role="alert">{message}</p></main>;
  if (reward.status === "redeemed") return <main className="experience-reward-page" dir="rtl">
    <h1>سيرتك جاهزة</h1><p>نسختك النهائية محفوظة بقالب Darbak ATS Classic.</p>
    <button type="button" onClick={download} disabled={busy}>تنزيل PDF</button>
    {message && <p role="status">{message}</p>}
  </main>;

  return <main className="experience-reward-page" dir="rtl">
    <h1>إنشاء سيرتي الذاتية</h1>
    <p>نسخة واحدة بقالب Darbak ATS Classic. يمكنك تعديلها ومعاينتها قبل الاعتماد النهائي.</p>
    {!language ? <section className="experience-reward-card">
      <h2>اختر لغة السيرة</h2>
      <div className="experience-reward-actions">
        <button type="button" onClick={() => setLanguage("ar")}>العربية</button>
        <button type="button" onClick={() => setLanguage("en")}>English</button>
      </div>
    </section> : <>
      <p className="experience-reward-language">اللغة: {language === "ar" ? "العربية" : "English"}</p>
      {language === "en" && <p>راجع النصوص المعبأة واكتبها بالإنجليزية. لا توجد ترجمة تلقائية.</p>}
      <section className="experience-reward-card experience-reward-grid">
        {[
          ["fullName", "الاسم", true], ["city", "المدينة"], ["email", "البريد الإلكتروني", true],
          ["phone", "الجوال (اختياري)"], ["linkedin", "LinkedIn (اختياري)"],
          ["major", "التخصص أو المؤهل"], ["university", "الجامعة أو جهة المؤهل"],
          ["graduationYear", "سنة التخرج"], ["gpa", "المعدل (اختياري)"],
        ].map(([key, label, required]) => <label key={key}>{label}
          <input value={draft[key] || ""} onChange={(event) => setField(key, event.target.value)} required={Boolean(required)} />
        </label>)}
      </section>
      {sections.map(([key, title]) => <section className="experience-reward-card" key={key}>
        <h2>{title}</h2>
        {key === "trainingExperience" && <p className="experience-reward-hint">هذه تجربة التدريب التي منحتك المكافأة. راجع بياناتها وأكمل مساهماتك دون تغيير ما لم تكتبه بنفسك.</p>}
        {(draft[key] || []).map((entry, index) => <div className="experience-reward-entry" key={`${key}-${index}`}>
          {entryFields[key].map(([field, label]) => <label key={field}>{label}
            <input value={entry[field] || ""} onChange={(event) => setEntry(key, index, field, event.target.value)} />
          </label>)}
          {key !== "certifications" && <RewardBulletRows section={key} entry={entry}
            onChange={(value) => setEntry(key, index, "description", value)} />}
          {key !== "trainingExperience" && <button type="button" className="secondary experience-reward-remove"
            onClick={() => setField(key, draft[key].filter((_, offset) => offset !== index))}>حذف {title}</button>}
        </div>)}
        {key !== "trainingExperience" && <button type="button" className="secondary"
          onClick={() => setField(key, [...(draft[key] || []), emptyEntry()])}>إضافة {title}</button>}
      </section>)}
      <section className="experience-reward-card experience-reward-grid">
        <label>المهارات (كل مهارة في سطر)<textarea rows="4" placeholder="مثال: Excel\nتحليل البيانات\nالتواصل"
          value={(draft.skills || []).join("\n")} onChange={(event) => setField("skills", event.target.value.split("\n"))} />
          <span className="experience-reward-hint">أضف ثلاث مهارات على الأقل. تُحذف المهارات المكررة عند المعاينة.</span>
          <span className="experience-reward-chips">{[...new Set((draft.skills || []).map((skill) => skill.trim()).filter(Boolean))]
            .map((skill) => <span key={skill}>{skill}</span>)}</span>
        </label>
        <label>اللغات (كل لغة في سطر)<textarea rows="4" value={(draft.languages || []).map((item) => item.name).join("\n")} onChange={(event) => setField("languages", event.target.value.split("\n").filter(Boolean).map((name) => ({ name, level: "" })))} /></label>
      </section>
      <section className="experience-reward-card experience-reward-readiness" aria-label="جاهزية سيرتك">
        <h2>جاهزية سيرتك</h2>
        <ul>{readiness.checks.map((check) => <li key={check.key}>
          <span>{check.ready ? "✓" : "○"} {check.label}</span>
          <span>{check.required ? "مطلوب" : "اختياري"}</span>
        </li>)}</ul>
        {readiness.missing.length > 0 && <p className="experience-reward-hint">قبل الاعتماد: {readiness.missing.join("، ")}.</p>}
      </section>
      <div className="experience-reward-actions">
        {language === "en" && <label className="experience-reward-review">
          <input type="checkbox" checked={englishReviewed} onChange={(event) => setEnglishReviewed(event.target.checked)} />
          راجعت نص السيرة بالإنجليزية
        </label>}
        <button type="button" className="secondary" disabled={busy} onClick={preview}>معاينة السيرة</button>
        <button type="button" disabled={busy} onClick={finalize}>اعتماد وإنشاء السيرة الذاتية</button>
      </div>
      {previewUrl && <iframe className="experience-reward-preview" title="معاينة السيرة الذاتية" src={previewUrl} />}
    </>}
    {message && <p role="status">{message}</p>}
  </main>;
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import API_BASE_URL from "../config/api";
import ResumePdfDocument from "../features/resume/ResumePdfDocument";
import { deriveRewardProfessionalTitle, toAtsClassicResume } from "../utils/experienceRewardResume";
import { cleanRewardDraft, getRewardReadiness, splitRewardBulletRows } from "../utils/experienceRewardResumeQuality";
import { resumeCityOptions, resumeMajorOptions, resumeUniversityOptions } from "../data/resumeCanonicalOptions";
import { getStoredAccessIdentity } from "../utils/premiumAccess";
import "./ExperienceRewardResumePage.css";

const sections = [["trainingExperience", "تجربة التدريب"], ["experience", "الخبرات"],
  ["projects", "المشاريع"], ["certifications", "الشهادات"]];
const emptyEntry = () => ({ title: "", organization: "", location: "", period: "", description: "", tools: [] });

const entryFields = {
  trainingExperience: [["title", "المسمى أو القسم"], ["organization", "جهة التدريب"], ["location", "المدينة"], ["period", "الفترة"]],
  experience: [["title", "المسمى أو القسم"], ["organization", "الجهة"], ["location", "المدينة"], ["period", "الفترة"]],
  projects: [["title", "اسم المشروع"]],
  certifications: [["title", "اسم الشهادة"], ["organization", "الجهة المانحة"], ["period", "التاريخ"]],
};

function RewardBulletRows({ section, entry, onChange }) {
  const maximum = section === "projects" ? 3 : 4;
  const rows = splitRewardBulletRows(entry.description);
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
        }} onBlur={() => {
          const next = [...rows]; next[index] = next[index].trim(); update(next);
        }} />
      </label>
      {rows.length > 1 && <button type="button" className="secondary" aria-label={`حذف نقطة ${index + 1}`}
        onClick={() => update(rows.filter((_, offset) => offset !== index))}>حذف</button>}
    </div>)}
    {rows.length < maximum && <button type="button" className="secondary" onClick={() => update([...rows, ""])}>+ أضف نقطة</button>}
  </div>;
}

function RewardChipsInput({ label, values = [], onChange, placeholder }) {
  const [input, setInput] = useState("");
  const add = () => {
    const value = input.trim();
    if (value && !values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      onChange([...values, value]);
    }
    setInput("");
  };
  return <div className="experience-reward-chip-field">
    <label>{label}
      <input value={input} placeholder={placeholder} onChange={(event) => setInput(event.target.value)}
        onBlur={add} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "," || event.key === "،") {
            event.preventDefault(); add();
          }
        }} />
    </label>
    <div className="experience-reward-chips">{values.map((value, index) => <span key={`${value}-${index}`}>
      {value}<button type="button" aria-label={`حذف ${value}`}
        onClick={() => onChange(values.filter((_, offset) => offset !== index))}>×</button>
    </span>)}</div>
  </div>;
}

export default function ExperienceRewardResumePage() {
  const [reward, setReward] = useState(null);
  const [draft, setDraft] = useState(null);
  const [language, setLanguage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [englishReviewed, setEnglishReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sourceNarrative, setSourceNarrative] = useState("");
  const [saveRevision, setSaveRevision] = useState(0);
  const [saveState, setSaveState] = useState("");
  const draftRef = useRef(null);
  const languageRef = useRef("");
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve());
  const mountedRef = useRef(true);
  const hadSavedDraftRef = useRef(false);
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
        hadSavedDraftRef.current = Boolean(data.reward.hasDraft || data.draft);
        setLanguage(data.reward.language || "");
        languageRef.current = data.reward.language || "";
        const loaded = data.draft || data.prefill;
        const suggestion = data.reward.aiSuggestion;
        savedRevisionRef.current = data.draft ? 0 : -1;
        const restored = suggestion ? {
          ...loaded,
          professionalSummary: loaded.professionalSummary || suggestion.professionalSummary,
          trainingExperience: (loaded.trainingExperience || []).map((entry, index) => index === 0
            ? { ...entry, description: entry.description || suggestion.trainingBullets.join("\n") } : entry),
        } : loaded;
        draftRef.current = restored;
        setDraft(restored);
        setSourceNarrative(data.sourceNarrative || "");
      })
      .catch((error) => live && setMessage(error.response?.data?.error || "تعذر تحميل المكافأة حاليًا."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [headers]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const updateDraft = (next, nextLanguage = languageRef.current) => {
    draftRef.current = next;
    languageRef.current = nextLanguage;
    setDraft(next);
    setLanguage(nextLanguage);
    revisionRef.current += 1;
    setSaveRevision(revisionRef.current);
    setSaveState("saving");
    setPreviewUrl("");
  };
  const setField = (name, value) => updateDraft({ ...draftRef.current, [name]: value });
  const selectLanguage = (value) => {
    const current = draftRef.current;
    updateDraft({ ...current,
      professionalTitle: current.professionalTitle || deriveRewardProfessionalTitle(current.major, value),
    }, value);
  };
  const setEntry = (section, index, field, value) => {
    const current = draftRef.current;
    updateDraft({ ...current, [section]: current[section].map((entry, offset) =>
      offset === index ? { ...entry, [field]: value } : entry) });
  };
  const readiness = getRewardReadiness(draft || {}, language);
  const saveDraft = useCallback(() => {
    const revision = revisionRef.current;
    const cleaned = cleanRewardDraft(draftRef.current);
    const selectedLanguage = languageRef.current;
    if (!selectedLanguage) return Promise.reject(new Error("Choose a language first"));
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(async () => {
      if (revision <= savedRevisionRef.current) return cleaned;
      const { data } = await axios.put(`${API_BASE_URL}/api/rewards/resume/draft`,
        { language: selectedLanguage, draft: cleaned }, { headers });
      savedRevisionRef.current = revision;
      if (!hadSavedDraftRef.current) {
        hadSavedDraftRef.current = true;
        window.dispatchEvent(new Event("darbak:experience-reward-updated"));
      }
      if (mountedRef.current && revision === revisionRef.current) setSaveState("saved");
      return data.draft;
    }).catch((error) => {
      if (mountedRef.current) setSaveState("error");
      throw error;
    });
    return saveQueueRef.current;
  }, [headers]);

  useEffect(() => {
    if (reward?.status !== "available" || !draft || !language || saveRevision <= savedRevisionRef.current) return undefined;
    const timer = setTimeout(() => { saveDraft().catch(() => {}); }, 500);
    return () => clearTimeout(timer);
  }, [draft, language, reward?.status, saveDraft, saveRevision]);

  useEffect(() => {
    if (reward?.status !== "available") return undefined;
    const preserveLatestDraft = () => {
      if (!languageRef.current || revisionRef.current <= savedRevisionRef.current) return;
      if (typeof fetch !== "function") return;
      fetch(`${API_BASE_URL}/api/rewards/resume/draft`, {
        method: "PUT", keepalive: true,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ language: languageRef.current, draft: cleanRewardDraft(draftRef.current) }),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", preserveLatestDraft);
    return () => window.removeEventListener("pagehide", preserveLatestDraft);
  }, [headers, reward?.status]);
  const suggestWriting = async () => {
    if (!splitRewardBulletRows(draft.trainingExperience?.[0]?.description).some((line) => line.trim())) {
      setMessage("أضف ما عملته فعليًا في التدريب أولًا، ثم اطلب اقتراح الصياغة.");
      return;
    }
    let suggestionRequested = false;
    try {
      setBusy(true); setMessage("");
      await saveDraft();
      suggestionRequested = true;
      const { data } = await axios.post(`${API_BASE_URL}/api/rewards/resume/suggest`, {}, { headers });
      setReward((current) => ({ ...current, aiGenerationAttemptedAt: new Date().toISOString() }));
      updateDraft({ ...draftRef.current,
        professionalSummary: data.suggestion.professionalSummary,
        trainingExperience: draftRef.current.trainingExperience.map((entry, index) => index === 0
          ? { ...entry, description: data.suggestion.trainingBullets.join("\n") } : entry),
      });
      setMessage("راجع الصياغة المقترحة وعدّلها قبل الاعتماد.");
    } catch (error) {
      if (suggestionRequested && error.response?.status !== 400) {
        setReward((current) => ({ ...current, aiGenerationAttemptedAt: new Date().toISOString() }));
      }
      setMessage(error.response?.data?.error || "تعذر اقتراح الصياغة الآن. اكتب النبذة والنقاط بنفسك؛ مكافأتك محفوظة.");
    } finally { setBusy(false); }
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
      window.dispatchEvent(new Event("darbak:experience-reward-updated"));
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
  const viewFinal = async () => {
    try {
      setBusy(true); setMessage("");
      const { data } = await axios.get(`${API_BASE_URL}/api/rewards/resume/pdf`,
        { headers, responseType: "blob" });
      setPreviewUrl(URL.createObjectURL(new Blob([data], { type: "application/pdf" })));
    } catch { setMessage("تعذر عرض السيرة حاليًا."); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="experience-reward-page" dir="rtl">جاري تحميل المكافأة...</main>;
  if (!reward) return <main className="experience-reward-page" dir="rtl"><h1>مكافأة السيرة الذاتية</h1><p role="alert">{message}</p></main>;
  if (reward.status === "redeemed") return <main className="experience-reward-page" dir="rtl">
    <h1>سيرتك جاهزة ✅</h1><p>تم إنشاء سيرتك الذاتية وحفظها في حسابك.</p>
    <div className="experience-reward-actions">
      <button type="button" className="secondary" onClick={viewFinal} disabled={busy}>عرض السيرة</button>
      <button type="button" onClick={download} disabled={busy}>تنزيل PDF</button>
    </div>
    {previewUrl && <iframe className="experience-reward-preview" title="السيرة الذاتية النهائية" src={previewUrl} />}
    {message && <p role="status">{message}</p>}
  </main>;

  return <main className="experience-reward-page" dir="rtl" onBlurCapture={() => {
    if (languageRef.current && revisionRef.current > savedRevisionRef.current) saveDraft().catch(() => {});
  }}>
    <h1>إنشاء سيرتي الذاتية</h1>
    <p>نسخة واحدة بقالب Darbak ATS Classic. يمكنك تعديلها ومعاينتها قبل الاعتماد النهائي.</p>
    {!language ? <section className="experience-reward-card">
      <h2>اختر لغة السيرة</h2>
      <div className="experience-reward-actions">
        <button type="button" onClick={() => selectLanguage("ar")}>العربية</button>
        <button type="button" onClick={() => selectLanguage("en")}>English</button>
      </div>
    </section> : <>
      <p className="experience-reward-language">اللغة: {language === "ar" ? "العربية" : "English"}</p>
      {saveState && <p aria-live="polite" className="experience-reward-save-state">
        {saveState === "saving" ? "جارٍ حفظ المسودة..." : saveState === "saved" ? "المسودة محفوظة في حسابك" :
          "تعذر حفظ المسودة. حاول المعاينة مجددًا قبل المغادرة."}
      </p>}
      {language === "en" && <p>راجع النصوص المعبأة واكتبها بالإنجليزية. لا توجد ترجمة تلقائية.</p>}
      <section className="experience-reward-card experience-reward-grid">
        {[
          ["fullName", "الاسم", true], ["city", "المدينة الحالية"], ["email", "البريد الإلكتروني", true],
          ["phone", "الجوال (اختياري)"], ["linkedin", "LinkedIn (اختياري)"],
          ["professionalTitle", "المسمى المهني (قابل للتعديل)"],
        ].map(([key, label, required]) => <label key={key}>{label}
          <input value={draft[key] || ""} onChange={(event) => setField(key, event.target.value)} required={Boolean(required)} />
        </label>)}
      </section>
      <section className="experience-reward-card experience-reward-grid">
        <h2 className="experience-reward-wide">التعليم</h2>
        {[["university", "الجامعة", "reward-universities"], ["major", "التخصص", "reward-majors"],
          ["graduationYear", "سنة التخرج", "reward-years"], ["educationCity", "مدينة الجامعة", "reward-cities"],
          ["degree", "الدرجة العلمية (اختياري)", ""], ["gpa", "المعدل (اختياري)", ""]]
          .map(([key, label, list]) => <label key={key}>{label}
            <input value={draft[key] || ""} list={list || undefined}
              onChange={(event) => setField(key, event.target.value)} required={!['degree', 'gpa'].includes(key)} />
          </label>)}
      </section>
      <section className="experience-reward-card">
        <h2>النبذة المهنية</h2>
        <p className="experience-reward-hint">سطران إلى ثلاثة عن تخصصك ومهاراتك وتدريبك. يمكنك كتابتها بنفسك.</p>
        <textarea rows="3" value={draft.professionalSummary || ""}
          onChange={(event) => setField("professionalSummary", event.target.value)} />
      </section>
      {sections.map(([key, title]) => <section className="experience-reward-card" key={key}>
        <h2>{title}</h2>
        {key === "trainingExperience" && <>
          <p className="experience-reward-hint">جهة التدريب والمدينة والفترة مأخوذة من تجربتك. اكتب فقط المهام والوقائع المناسبة للسيرة؛ وصف التجربة المنشورة لا يُنسخ إلى الـPDF.</p>
          {sourceNarrative && <details className="experience-reward-source"><summary>عرض وصف تجربتك للرجوع إلى الوقائع</summary><p>{sourceNarrative}</p></details>}
        </>}
        {(draft[key] || []).map((entry, index) => <div className="experience-reward-entry" key={`${key}-${index}`}>
          {entryFields[key].map(([field, label]) => <label key={field}>{label}
            <input value={entry[field] || ""} onChange={(event) => setEntry(key, index, field, event.target.value)} />
          </label>)}
          {key !== "certifications" && <RewardBulletRows section={key} entry={entry}
            onChange={(value) => setEntry(key, index, "description", value)} />}
          {key === "projects" && <RewardChipsInput label="الأدوات والتقنيات" placeholder="اكتب أداة ثم Enter"
            values={entry.tools || []} onChange={(values) => setEntry(key, index, "tools", values)} />}
          {key !== "trainingExperience" && <button type="button" className="secondary experience-reward-remove"
            onClick={() => setField(key, draft[key].filter((_, offset) => offset !== index))}>حذف {title}</button>}
        </div>)}
        {key !== "trainingExperience" && <button type="button" className="secondary"
          onClick={() => setField(key, [...(draft[key] || []), emptyEntry()])}>إضافة {title}</button>}
      </section>)}
      <section className="experience-reward-card">
        <h2>اقتراح صياغة مهنية</h2>
        <p className="experience-reward-hint">اقتراح واحد للنبذة ومهام التدريب بناءً على الوقائع التي كتبتها. راجع النص وعدّله؛ لن تُستهلك المكافأة.</p>
        <button type="button" className="secondary" onClick={suggestWriting}
          disabled={busy || Boolean(reward.aiGenerationAttemptedAt)}>اقترح الصياغة مرة واحدة</button>
      </section>
      <section className="experience-reward-card experience-reward-grid">
        <RewardChipsInput label="المهارات (ثلاث على الأقل)" placeholder="أضف مهارة ثم Enter"
          values={draft.skills || []} onChange={(values) => setField("skills", values)} />
        <RewardChipsInput label="اللغات" placeholder="أضف لغة ثم Enter"
          values={(draft.languages || []).map((item) => item.name)}
          onChange={(values) => setField("languages", values.map((name) => ({ name, level: "" })))} />
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
      <datalist id="reward-universities">{resumeUniversityOptions.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="reward-majors">{resumeMajorOptions.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="reward-cities">{resumeCityOptions.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id="reward-years">{Array.from({ length: 55 }, (_, index) => String(new Date().getFullYear() + 5 - index))
        .map((value) => <option key={value} value={value} />)}</datalist>
    </>}
    {message && <p role="status">{message}</p>}
  </main>;
}

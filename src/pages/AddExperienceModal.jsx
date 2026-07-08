import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import majors from "../majors"; // قائمة التخصصات
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";

const EXPERIENCE_DRAFT_KEY = "darbak_add_experience_draft_v1";

const getSavedDraft = () => {
  if (typeof window === "undefined") return null;

  try {
    const savedDraft = window.localStorage.getItem(EXPERIENCE_DRAFT_KEY);
    return savedDraft ? JSON.parse(savedDraft) : null;
  } catch {
    return null;
  }
};

const clearSavedDraft = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(EXPERIENCE_DRAFT_KEY);
  } catch {
    // Ignore private browsing or storage permission errors.
  }
};

const isUnclearMajorText = (value = "") => {
  const text = value.toString().trim();
  if (!text) return true;

  const letters = text.match(/[A-Za-z\u0600-\u06FF]/g) || [];
  return letters.length < 2;
};

const getYesNoDraftValue = (value = "") =>
  ["yes", "no"].includes(value) ? value : "";

export default function AddExperienceModal({ onClose, onSaved }) {
  const savedDraft = useMemo(() => getSavedDraft(), []);
  const [step, setStep] = useState(savedDraft?.step || 0);
  const totalSteps = 6; // خطوات الإدخال: 0..5 ، بعد الحفظ step === totalSteps => شاشة النجاح

  // form state
  const [organizationName, setOrganizationName] = useState(savedDraft?.organizationName || "");
  const [city, setCity] = useState(savedDraft?.city || "");
  const [customCity, setCustomCity] = useState(savedDraft?.customCity || "");
  const [duration, setDuration] = useState(savedDraft?.duration || "");
  const [howApplied, setHowApplied] = useState(savedDraft?.howApplied || "");
  const [ratings, setRatings] = useState(Array.isArray(savedDraft?.ratings) ? savedDraft.ratings : []); // up to 2
  const [description, setDescription] = useState(savedDraft?.description || "");
  const [majorCategory, setMajorCategory] = useState(savedDraft?.majorCategory || "");
  const [customMajorCategory, setCustomMajorCategory] = useState(savedDraft?.customMajorCategory || "");
  const [major, setMajor] = useState(savedDraft?.major || "");
  const [customMajor, setCustomMajor] = useState(savedDraft?.customMajor || "");
  const [trainingYear, setTrainingYear] = useState(savedDraft?.trainingYear || "");
  const [wasHired, setWasHired] = useState(getYesNoDraftValue(savedDraft?.wasHired));
  const [hadReward, setHadReward] = useState(getYesNoDraftValue(savedDraft?.hadReward));
  const [rewardAmount, setRewardAmount] = useState(savedDraft?.rewardAmount || "");
  const [trainingEnvironment, setTrainingEnvironment] = useState(savedDraft?.trainingEnvironment || "");
  const [benefitedFromTraining, setBenefitedFromTraining] = useState(
    getYesNoDraftValue(savedDraft?.benefitedFromTraining)
  );
  const [wouldRecommend, setWouldRecommend] = useState(
    getYesNoDraftValue(savedDraft?.wouldRecommend)
  );
  const [trainingMode, setTrainingMode] = useState(savedDraft?.trainingMode || "");
  

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [starRating, setStarRating] = useState(savedDraft?.starRating || 0); // من 1 إلى 5
  const minDescriptionLength = 50;
  const descriptionLength = description.trim().length;
  const finalCity = city === "أخرى" ? customCity.trim() : city.trim();
  const finalMajorCategory =
    majorCategory === "أخرى" ? customMajorCategory.trim() : majorCategory.trim();
  const finalMajor = major === "أخرى" ? customMajor.trim() : major.trim();
  const hasClearMajorCategory =
    finalMajorCategory.length > 0 && !isUnclearMajorText(finalMajorCategory);
  const hasClearMajor = finalMajor.length > 0 && !isUnclearMajorText(finalMajor);
  const selectedMajorCategory = majors.find((item) => item.name === majorCategory);
  const subMajorOptions = selectedMajorCategory?.subMajors || [];

  useEffect(() => {
    trackEvent("add_experience_started", {
      metadata: {
        resumedDraft: Boolean(savedDraft),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hadReward !== "yes" && rewardAmount) {
      setRewardAmount("");
    }
  }, [hadReward, rewardAmount]);

  const howAppliedOptions = [
    "موقع الجهة الرسمي",
    "ترشيح من الجامعة",
    "توصية من أصدقاء/معارف",
    "LinkedIn",
    "منصة توظيف / تمهير",
    "تقديم يدوي",
    "بحث شخصي / مراسلة مباشرة",
    "أخرى",
  ];

  const ratingOptions = [
    { id: "excellent", label: "😍 ممتازة ومثرية جدًا" },
    { id: "nice", label: "😊 لطيفة وخفيفة" },
    { id: "enriching", label: "💡 مثرية وتعلمت منها كثير" },
    { id: "challenging", label: "🤔 متوسطة وفيها تحديات" },
    { id: "notgood", label: "😕 غير مرضية" },
  ];

  const cityOptions = [
    "الرياض",
    "جدة",
    "الدمام",
    "مكة المكرمة",
    "المدينة المنورة",
    "الخبر",
    "الظهران",
    "الأحساء",
    "الجبيل",
    "القطيف",
    "رأس تنورة",
    "حفر الباطن",
    "الطائف",
    "تبوك",
    "أبها",
    "خميس مشيط",
    "نجران",
    "جازان",
    "الباحة",
    "حائل",
    "بريدة",
    "عنيزة",
    "الرس",
    "سكاكا",
    "عرعر",
    "رفحاء",
    "القريات",
    "ينبع",
    "رابغ",
    "الخرج",
    "الدرعية",
    "المجمعة",
    "الزلفي",
    "الدوادمي",
    "وادي الدواسر",
    "القويعية",
    "شقراء",
    "عفيف",
    "حوطة بني تميم",
    "الرس",
    "المذنب",
    "البكيرية",
    "البدائع",
    "الأسياح",
    "رياض الخبراء",
    "الخفجي",
    "بقيق",
    "النعيرية",
    "قرية العليا",
    "الوجه",
    "ضباء",
    "أملج",
    "تيماء",
    "البدع",
    "العلا",
    "خيبر",
    "بدر",
    "المهد",
    "الحناكية",
    "القنفذة",
    "الليث",
    "رنية",
    "تربة",
    "الخرمة",
    "بحرة",
    "بيشة",
    "محايل عسير",
    "النماص",
    "تنومة",
    "رجال ألمع",
    "سراة عبيدة",
    "ظهران الجنوب",
    "شرورة",
    "حبونا",
    "يدمة",
    "صبيا",
    "أبو عريش",
    "صامطة",
    "بيش",
    "الدرب",
    "فرسان",
    "بلجرشي",
    "المندق",
    "العقيق",
    "المخواة",
    "القنفذة",
    "طريف",
    "دومة الجندل",
    "طبرجل",
    "أخرى",
  ];


  const durationOptions = Array.from({ length: 12 }, (_, i) =>
    i + 1 === 1 ? "شهر" : `${i + 1} أشهر`
  );

  const currentYear = new Date().getFullYear();
  const trainingYearOptions = Array.from({ length: 7 }, (_, i) =>
    String(currentYear - i)
  );

  const quickOptionalFields = [
    {
      id: "hadReward",
      label: "هل كانت التجربة بمكافأة؟",
      value: hadReward,
      setter: setHadReward,
      options: [
        { value: "yes", label: "نعم، بمكافأة" },
        { value: "no", label: "لا، بدون مكافأة" },
      ],
    },
    {
      id: "wasHired",
      label: "هل وصلك عرض توظيف بعد التدريب؟",
      value: wasHired,
      setter: setWasHired,
      options: [
        { value: "yes", label: "نعم، وصلني عرض" },
        { value: "no", label: "لا، ما وصلني عرض" },
      ],
    },
    {
      id: "trainingEnvironment",
      label: "بيئة التدريب",
      value: trainingEnvironment,
      setter: setTrainingEnvironment,
      options: [
        { value: "mixed", label: "مختلطة" },
        { value: "women", label: "نساء" },
        { value: "men", label: "رجال" },
      ],
    },
    {
      id: "trainingMode",
      label: "نوع التدريب",
      value: trainingMode,
      setter: setTrainingMode,
      options: [
        { value: "onsite", label: "حضوري" },
        { value: "remote", label: "عن بعد" },
      ],
    },
    {
      id: "benefitedFromTraining",
      label: "هل استفدت من التدريب؟",
      value: benefitedFromTraining,
      setter: setBenefitedFromTraining,
      options: [
        { value: "yes", label: "نعم، استفدت" },
        { value: "no", label: "لا، لم أستفد" },
      ],
    },
    {
      id: "wouldRecommend",
      label: "هل تنصح بالتدريب فيها؟",
      value: wouldRecommend,
      setter: setWouldRecommend,
      options: [
        { value: "yes", label: "نعم، أنصح" },
        { value: "no", label: "لا، لا أنصح" },
      ],
    },
  ];

  const handleClose = () => {
    if (onClose) onClose();
  };

  const hasDraftContent = useMemo(
    () =>
      Boolean(
        organizationName.trim() ||
          city.trim() ||
          customCity.trim() ||
          duration.trim() ||
          howApplied.trim() ||
          ratings.length > 0 ||
          description.trim() ||
          majorCategory.trim() ||
          customMajorCategory.trim() ||
          major.trim() ||
          customMajor.trim() ||
          trainingYear.trim() ||
          wasHired.trim() ||
          hadReward.trim() ||
          rewardAmount.trim() ||
          trainingEnvironment.trim() ||
          benefitedFromTraining.trim() ||
          wouldRecommend.trim() ||
          trainingMode.trim() ||
          starRating > 0
      ),
    [
      organizationName,
      city,
      customCity,
      duration,
      howApplied,
      ratings,
      description,
      majorCategory,
      customMajorCategory,
      major,
      customMajor,
      trainingYear,
      wasHired,
      hadReward,
      rewardAmount,
      trainingEnvironment,
      benefitedFromTraining,
      wouldRecommend,
      trainingMode,
      starRating,
    ]
  );

  useEffect(() => {
    if (step >= totalSteps) return;

    if (!hasDraftContent) {
      clearSavedDraft();
      return;
    }

    const draft = {
      step,
      organizationName,
      city,
      customCity,
      duration,
      howApplied,
      ratings,
      description,
      majorCategory,
      customMajorCategory,
      major,
      customMajor,
      trainingYear,
      wasHired,
      hadReward,
      rewardAmount,
      trainingEnvironment,
      benefitedFromTraining,
      wouldRecommend,
      trainingMode,
      starRating,
      updatedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(EXPERIENCE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignore private browsing or storage quota errors.
    }
  }, [
    step,
    totalSteps,
    hasDraftContent,
    organizationName,
    city,
    customCity,
    duration,
    howApplied,
    ratings,
    description,
    majorCategory,
    customMajorCategory,
    major,
    customMajor,
    trainingYear,
    wasHired,
    hadReward,
    rewardAmount,
    trainingEnvironment,
    benefitedFromTraining,
    wouldRecommend,
    trainingMode,
    starRating,
  ]);

  const toggleRating = (id) => {
    setRatings((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  // تصحيح منطق canNext
  const canNext = () => {
    switch (step) {
      case 0:
        return organizationName.trim().length > 0 && finalCity.length > 0;
      case 1:
        return hasClearMajorCategory && hasClearMajor;
      case 2:
        return howApplied.trim().length > 0;
      case 3:
        return duration.trim().length > 0;
      case 4:
        return starRating > 0 && descriptionLength >= minDescriptionLength;
      case 5:
        return true;
        
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!organizationName.trim() || !finalCity || !finalMajorCategory || !finalMajor || !howApplied.trim() || !duration.trim() || ratings.length === 0) {
      setError("الرجاء إكمال جميع الحقول المطلوبة.");
      return;
    }

    if (!hasClearMajorCategory || !hasClearMajor) {
      setError("الرجاء اختيار أو كتابة تخصص واضح بدون رموز أو أرقام فقط.");
      return;
    }

    if (descriptionLength < minDescriptionLength) {
      setError(`وصف التجربة يجب ألا يقل عن ${minDescriptionLength} حرفًا.`);
      return;
    }

    const payload = {
      title: `تجربتي في ${organizationName}`,
      organizationName,
      city: finalCity,
      majorCategory: finalMajorCategory,
      major: finalMajor,
      howApplied,
      duration,
      trainingYear,
      wasHired,
      hadReward,
      rewardAmount: hadReward === "yes" ? rewardAmount.trim() : "",
      trainingEnvironment,
      benefitedFromTraining,
      wouldRecommend,
      trainingMode,
      ratings,        // ممكن تخلينه أو تحذفينه لاحقًا
      starRating,     // ⭐ الجديد
      description,
      createdAt: new Date().toISOString(),
    };
    

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/experiences`, payload);

      if (!res.data || typeof res.data !== "object" || !res.data._id) {
        throw new Error("Unexpected API response");
      }

      setLoading(false);
      if (onSaved) onSaved(res.data);
      trackEvent("add_experience_submitted", {
        major: finalMajor,
        majorCategory: finalMajorCategory,
        city: finalCity,
        resultsCount: 1,
        metadata: {
          organizationName,
          hadReward,
          wasHired,
          trainingEnvironment,
          trainingMode,
          starRating,
        },
      });
      clearSavedDraft();
      setStep(totalSteps); // شاشة النجاح
    } catch (err) {
      console.error("Error saving experience:", err);
      setLoading(false);
      setError(
        err.response?.data?.error ||
          "حدث خطأ أثناء الحفظ. تأكدي من اتصال خدمة API ثم حاولي مرة أخرى."
      );
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round(((step + 1) / (totalSteps + 1)) * 100)
  );

  // إضافة الاقتراح للنص وعلامته كمستخدمة
 

  const StarRating = ({ value, onChange }) => {
    return (
      <div
        style={{
          display: "flex",
          gap: 7,
          alignItems: "center",
          justifyContent: "center",
          margin: "12px 0 4px",
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => onChange(star)}
            aria-label={`تقييم ${star} من 5`}
            style={{
              width: 34,
              height: 34,
              border: "none",
              background: "transparent",
              color: star <= value ? "var(--app-brand)" : "rgba(148,163,184,0.38)",
              cursor: "pointer",
              fontSize: 28,
              lineHeight: 1,
              padding: 0,
              textShadow:
                star <= value ? "0 0 12px rgba(125,219,205,0.26)" : "none",
              transition: "color 0.2s, transform 0.2s",
            }}
          >
            ★
          </button>
        ))}
      </div>
    );
  };
  
  return (
    <div
      className="stepper-modal-bg"
      onClick={(e) => e.target.classList.contains("stepper-modal-bg") && handleClose()}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 12000,
        padding: 20,
        fontFamily: "'Cairo', sans-serif",
        direction: "rtl",
        boxSizing: "border-box",
      }}
    >
      <div
        className="stepper-modal-card"
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: 14,
          background: "var(--app-surface)",
          color: "var(--app-text)",
          boxShadow: "0 28px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
          maxHeight: "calc(100dvh - 40px)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ padding: 18, borderBottom: "1px solid var(--app-border-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: "var(--app-bg)", borderRadius: 8 }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,var(--app-muted),var(--app-brand))",
                    transition: "width 300ms ease",
                  }}
                />
              </div>
              <div style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 8 }}>
                خطوة {Math.min(step + 1, totalSteps)}/{totalSteps}
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--app-text-soft)",
                fontSize: 22,
                cursor: "pointer",
              }}
              aria-label="close"
            >
              ×
            </button>
          </div>
        </div>

        {/* body */}
        <div
          className="stepper-modal-body"
          style={{
            padding: 24,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            flex: 1,
          }}
        >
          {/* الخطوة 0 - بيانات الجهة */}
          {step === 0 && (
            <div>
              <h3 style={{ color: "var(--app-text)" }}>بيانات الجهة</h3>
              <p style={{ color: "var(--app-muted)" }}>اكتب/ي اسم الجهة والمدينة.</p>

              <input
                type="text"
                placeholder="🏢 اسم الجهة (مثلاً: هيئة البيانات والذكاء الاصطناعي)"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                  border: "1px solid var(--app-border-soft)",
                  marginBottom: 12,
                }}
              />

              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (e.target.value !== "أخرى") setCustomCity("");
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                  border: "1px solid var(--app-border-soft)",
                }}
              >
                <option value="">📍 اختر المدينة</option>
                {Array.from(new Set(cityOptions)).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {city === "أخرى" && (
                <input
                  type="text"
                  placeholder="اكتب/ي اسم المدينة"
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 12,
                    borderRadius: 10,
                    background: "var(--app-input-bg)",
                    color: "var(--app-text)",
                    border: "1px solid var(--app-border-soft)",
                    marginTop: 12,
                  }}
                />
              )}
            </div>
          )}

          {/* الخطوة 1 - التخصص */}
          {step === 1 && (
            <div>
              <h3 style={{ color: "var(--app-text)" }}>ما هو تخصصك؟</h3>
              <p style={{ color: "var(--app-muted)" }}>
                اختر/ي التخصص الرئيسي أولًا، ثم التخصص الفرعي.
              </p>

              <select
                value={majorCategory}
                onChange={(e) => {
                  setMajorCategory(e.target.value);
                  setMajor("");
                  setCustomMajor("");
                  if (e.target.value !== "أخرى") setCustomMajorCategory("");
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                  border: "1px solid var(--app-border-soft)",
                  marginTop: 10,
                }}
              >
                <option value="">🏛️ اختر/ي التخصص الرئيسي أو الكلية</option>
                {majors.map((m, i) => (
                  <option key={i} value={m.name}>
                    {m.name}
                  </option>
                ))}
                <option value="أخرى">أخرى</option>
              </select>

              {majorCategory === "أخرى" && (
                <>
                  <input
                    type="text"
                    placeholder="اكتب/ي التخصص الرئيسي أو الكلية"
                    value={customMajorCategory}
                    onChange={(e) => setCustomMajorCategory(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: 12,
                      borderRadius: 10,
                      background: "var(--app-input-bg)",
                      color: "var(--app-text)",
                      border: "1px solid var(--app-border-soft)",
                      marginTop: 12,
                    }}
                  />
                  {customMajorCategory.trim() &&
                    isUnclearMajorText(customMajorCategory) && (
                      <p style={{ color: "#fca5a5", fontSize: 12, margin: "7px 0 0" }}>
                        اكتب/ي اسم تخصص واضح، وليس أرقامًا أو رموزًا فقط.
                      </p>
                    )}
                </>
              )}

              <select
                value={major}
                onChange={(e) => {
                  setMajor(e.target.value);
                  if (e.target.value !== "أخرى") setCustomMajor("");
                }}
                disabled={!majorCategory}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                  border: "1px solid var(--app-border-soft)",
                  marginTop: 12,
                  opacity: majorCategory ? 1 : 0.55,
                }}
              >
                <option value="">🎓 اختر/ي التخصص الفرعي</option>
                {subMajorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="أخرى">أخرى</option>
              </select>

              {major === "أخرى" && (
                <>
                  <input
                    type="text"
                    placeholder="اكتب/ي التخصص الفرعي"
                    value={customMajor}
                    onChange={(e) => setCustomMajor(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: 12,
                      borderRadius: 10,
                      background: "var(--app-input-bg)",
                      color: "var(--app-text)",
                      border: "1px solid var(--app-border-soft)",
                      marginTop: 12,
                    }}
                  />
                  {customMajor.trim() && isUnclearMajorText(customMajor) && (
                    <p style={{ color: "#fca5a5", fontSize: 12, margin: "7px 0 0" }}>
                      اكتب/ي اسم تخصص واضح، وليس أرقامًا أو رموزًا فقط.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {/* الخطوة 2 - طريقة التقديم */}
          {step === 2 && (
            <div>
              <h3 style={{ color: "var(--app-text)" }}>كيف حصلت على فرصة التدريب؟</h3>
              <div className="option-grid" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
                {howAppliedOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setHowApplied(opt)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      background:
                        howApplied === opt
                          ? "linear-gradient(90deg,var(--app-muted),var(--app-brand))"
                          : "var(--app-input-bg)",
                      color: "var(--app-text)",
                      border: "1px solid var(--app-input-bg)",
                      cursor: "pointer",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الخطوة 3 - مدة التدريب */}
          {step === 3 && (
            <div>
              <h3 style={{ color: "var(--app-text)" }}>كم كانت مدة التدريب؟</h3>
              <div className="option-grid" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                {durationOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background:
                        duration === d
                          ? "linear-gradient(90deg,var(--app-muted),var(--app-brand))"
                          : "var(--app-input-bg)",
                      color: "var(--app-text)",
                      border: "1px solid var(--app-input-bg)",
                      cursor: "pointer",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الخطوة 4 - التقييم والوصف */}
          {step === 4 && (
            <div>
              <h3 style={{ color: "var(--app-text)" }}>قيّم/ي تجربتك</h3>
              <h4 style={{ marginTop: 12, color: "var(--app-text)" }}>
  التقييم العام للتجربة
</h4>
<p style={{ color: "var(--app-muted)", fontSize: 14 }}>
  قيّم/ي التجربة من 1 إلى 5 نجوم
</p>

<StarRating value={starRating} onChange={setStarRating} />

              <p style={{ color: "var(--app-muted)", marginTop: 18 }}>
                يمكنك اختيار تقييمين كحد أقصى.
              </p>

              <div className="option-grid" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
                {ratingOptions.map((r) => {
                  const selected = ratings.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggleRating(r.id)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 12,
                        background: selected
                          ? "linear-gradient(90deg,var(--app-muted),var(--app-brand))"
                          : "var(--app-input-bg)",
                        color: "var(--app-text)",
                        border: "1px solid var(--app-input-bg)",
                        cursor: "pointer",
                        minWidth: 200,
                        flex: "1 1 200px",
                      }}
                    >
                      {r.label}
                    </div>
                  );
                })}
              </div>

<div
  style={{
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    background: "var(--app-brand-soft)",
    border: "1px solid var(--app-brand-border)",
    color: "var(--app-text-soft)",
    fontSize: 14,
    lineHeight: 1.7,
  }}
>
  💡 لمساعدتنا ومساعدة غيرك:
  <ul style={{ marginTop: 6, paddingInlineStart: 18 }}>
    <ul>وش أكثر شيء تعلمته خلال التدريب؟</ul>
    <ul>هل كانت المهام واضحة ومفيدة؟</ul>
    <ul>هل تنصح غيرك بالتقديم؟ وليه؟</ul>
  </ul>
</div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder=" 👋 اكتب تجربتك بأسلوبك الشخصي، كلامك راح يساعد طلاب كثير. الحد الأدنى 50 حرفًا."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 120,
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--app-input-bg)",
                  color: "var(--app-text)",
                  border: "1px solid var(--app-border-soft)",
                  whiteSpace: "pre-wrap",
                }}
              />

              <div
                style={{
                  marginTop: 9,
                  padding: "9px 11px",
                  borderRadius: 10,
                  background: "var(--app-brand-soft)",
                  border: "1px solid var(--app-brand-border)",
                  color: "var(--app-text-soft)",
                  fontSize: 12,
                  lineHeight: 1.8,
                }}
              >
                لضمان قبول التجربة، الرجاء التركيز على الوقائع وتجنب ذكر أشخاص
                أو هويات أو عبارات شخصية أو تجريح مباشر.
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 8,
                  color:
                    descriptionLength >= minDescriptionLength
                      ? "#86efac"
                      : "#fca5a5",
                  fontSize: 13,
                }}
              >
                <span>الحد الأدنى للوصف {minDescriptionLength} حرفًا</span>
                <span>
                  {descriptionLength}/{minDescriptionLength}
                </span>
              </div>

             
              
         
         
            </div>
          )}

          {/* الخطوة 5 - معلومات سريعة */}
          {step === 5 && (
            <div>
              <h3 style={{ color: "var(--app-text)", marginBottom: 12 }}>
                معلومات سريعة عن التجربة
              </h3>

              <div
                className="quick-info-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <div
                  style={{
                    background: "var(--app-input-bg)",
                    border: "1px solid var(--app-input-bg)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      color: "#dbeafe",
                      fontSize: 13,
                      marginBottom: 8,
                    }}
                  >
                    سنة التدريب
                  </label>
                  <select
                    value={trainingYear}
                    onChange={(e) => setTrainingYear(e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "9px 8px",
                      borderRadius: 10,
                      background: "var(--app-input-bg)",
                      color: "var(--app-text)",
                      border: "1px solid var(--app-input-bg)",
                    }}
                  >
                    <option value="">لم أحدد</option>
                    {trainingYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {quickOptionalFields.map((field) => (
                  <div
                    key={field.label}
                    style={{
                      background: "var(--app-input-bg)",
                      border: "1px solid var(--app-input-bg)",
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <p
                      style={{
                        color: "#dbeafe",
                        fontSize: 13,
                        margin: "0 0 8px",
                      }}
                    >
                      {field.label}
                    </p>
                    <div style={{ display: "grid", gap: 6 }}>
                      {field.options.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            field.setter(
                              field.value === option.value ? "" : option.value
                            )
                          }
                          style={{
                            padding: "7px 8px",
                            borderRadius: 9,
                            background:
                              field.value === option.value
                                ? "linear-gradient(90deg,var(--app-muted),var(--app-brand))"
                                : "var(--app-input-bg)",
                            color: "var(--app-text)",
                            border: "1px solid var(--app-input-bg)",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {field.id === "hadReward" && field.value === "yes" && (
                        <input
                          type="text"
                          inputMode="text"
                          value={rewardAmount}
                          onChange={(e) => setRewardAmount(e.target.value)}
                          placeholder="قيمة المكافأة إن وجدت، مثل: 3000 ريال"
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            marginTop: 8,
                            padding: "8px 9px",
                            borderRadius: 9,
                            background: "var(--app-surface)",
                            color: "var(--app-text)",
                            border: "1px solid var(--app-border-soft)",
                            fontFamily: "inherit",
                            fontSize: 12,
                          }}
                        />
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* بعد الحفظ */}
          {step >= totalSteps && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <h3 style={{ color: "var(--app-text)" }}>وصلتنا تجربتك 🎉</h3>
              <p style={{ color: "#a9c0d6" }}>
                شكراً لمشاركتك! ستظهر تجربتك بعد مراجعتها واعتمادها.
              </p>
              <button
                onClick={handleClose}
                style={{
                  marginTop: 10,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "linear-gradient(90deg,var(--app-muted),var(--app-brand))",
                  color: "var(--app-text)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                العودة للتجارب
              </button>
            </div>
          )}

          {error && <div style={{ marginTop: 14, color: "#ffb4b4" }}>{error}</div>}
        </div>

        {/* footer - الرجوع موجود في كل خطوات */}
        {step < totalSteps && (
          <div
            className="stepper-modal-footer"
            style={{
              padding: 18,
              borderTop: "1px solid var(--app-border-soft)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexShrink: 0,
              background: "var(--app-surface)",
            }}
          >
          <div className="modal-footer-group" style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleClose}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "transparent",
                color: "var(--app-muted)",
                border: "1px solid var(--app-border-soft)",
                cursor: "pointer",
              }}
            >
              إلغاء
            </button>

            {/* زر الرجوع (يعمل في كل خطوة) */}
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: step === 0 ? "var(--app-input-bg)" : "var(--app-brand-soft)",
                color: "var(--app-text)",
                border: "1px solid var(--app-border-soft)",
                cursor: step === 0 ? "not-allowed" : "pointer",
              }}
            >
              رجوع
            </button>
          </div>

          <div className="modal-footer-action">
            {/* إذا نحن في آخر خطوة (قبل الحفظ) نعرض حفظ + رجوع */}
            {step === totalSteps - 1 ? (
              <div className="modal-footer-group" style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: "var(--app-input-bg)",
                    color: "var(--app-text)",
                    border: "1px solid var(--app-border)",
                    cursor: "pointer",
                  }}
                >
                  تعديل المعلومات
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: loading
                      ? "rgba(125,125,125,0.5)"
                      : "linear-gradient(90deg,var(--app-muted),var(--app-brand))",
                    color: "#07100e",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "جاري النشر..." : "نشر التجربة"}
                </button>
              </div>
            ) : (
              // أزرار التنقل في بقية الخطوات
              <div className="modal-footer-group" style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    if (canNext()) setStep((s) => s + 1);
                    else setError("الرجاء إكمال الحقول المطلوبة أولاً.");
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: "linear-gradient(90deg,var(--app-muted),var(--app-brand))",
                    color: "#07100e",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  التالي
                </button>
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      <style>{`
        .stepper-modal-card input,
        .stepper-modal-card select,
        .stepper-modal-card textarea,
        .stepper-modal-card button {
          font-family: inherit;
        }

        .stepper-modal-card input,
        .stepper-modal-card select,
        .stepper-modal-card textarea {
          background: var(--app-input-bg) !important;
          color: var(--app-text) !important;
          border-color: var(--app-border-soft) !important;
        }

        .stepper-modal-card input::placeholder,
        .stepper-modal-card textarea::placeholder {
          color: var(--app-muted) !important;
        }

        .stepper-modal-body h3,
        .stepper-modal-body h4 {
          color: var(--app-text) !important;
        }

        .stepper-modal-body p,
        .stepper-modal-body label {
          color: var(--app-muted) !important;
        }

        .stepper-modal-body > div > div,
        .quick-info-grid > div {
          border-color: var(--app-border-soft) !important;
        }

        @media (max-width: 640px) {
          .stepper-modal-bg {
            align-items: center !important;
            justify-content: center !important;
            padding: 12px !important;
          }

          .stepper-modal-card {
            max-height: calc(100dvh - 24px) !important;
            border-radius: 16px !important;
          }

          .stepper-modal-body {
            padding: 16px !important;
            padding-bottom: 18px !important;
          }

          .stepper-modal-body h3 {
            font-size: 18px;
            margin: 0 0 8px;
          }

          .stepper-modal-body p {
            font-size: 13px;
            line-height: 1.6;
          }

          .option-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }

          .option-grid button,
          .option-grid div,
          .quick-info-grid > div {
            width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box;
            padding: 10px 12px !important;
          }

          .quick-info-grid {
            grid-template-columns: 1fr !important;
          }

          .stepper-modal-footer {
            position: sticky;
            bottom: 0;
            padding: 10px !important;
            flex-direction: column-reverse;
            align-items: stretch !important;
            gap: 8px !important;
            box-shadow: 0 -12px 26px rgba(0,0,0,0.28);
          }

          .modal-footer-action,
          .modal-footer-group {
            width: 100%;
          }

          .modal-footer-group {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px !important;
          }

          .modal-footer-action .modal-footer-group {
            grid-template-columns: 1fr;
          }

          .stepper-modal-footer button {
            width: 100%;
            min-height: 42px;
            padding: 10px !important;
            font-size: 13px;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
